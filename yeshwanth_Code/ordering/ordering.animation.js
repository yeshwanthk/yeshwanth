angular.module('cv.ordering.animation', [])
  .factory('orderingAnimation', ['$rootScope', '$compile', '$q', '$timeout', 'productSpecificAnimation',
      function ($rootScope, $compile, $q, $timeout, productSpecificAnimation) {


          var createWidget = function (element, widgetInfo, scope) {
              var widget = {};
              // //console.log(widgetInfo.type);
              switch (widgetInfo.type) {
                  case 'panel':
                      widget = createPanelWidget(element, scope);
                      break;
                  case 'iconic':
                      widget = createIconicWidget(element, widgetInfo, scope);
                      break;
                  default:
                      throw Error('Error: Unsupported animation type!');
              }
              return widget;
          };


          var createPanelWidget = function (element, scope) {
              element = element.closest('.selection').find('.product-panel');

              // clone the directive and calculate its position
              var elementPos = element.offset(),
                containerPos = element.closest('.selection-panel').offset(),
                left = (elementPos.left - parseInt(element.css('margin-left'))) - containerPos.left,
                top = elementPos.top - containerPos.top,
                elementWidth = element.outerWidth();

              //remove 'recommended' class before copying
              if (element.hasClass('recommended')) {
                  var ribbon = element.find('#ordering-recommended-ribbon');
                  ribbon.fadeOut(1000);
                  $timeout(function () {
                      ribbon.show();
                  }, 1000)
              }

              var widget = $('<div class="widget-container selection panel">' + element.html() + '<span class="status-icon cv-icon-checkmark"></span></div>');
              widget.css({left: left, top: top, position: 'absolute', width: elementWidth});
              addWidget(element, widget, scope);
              return widget;

          };

          var createIconicWidget = function (element, widgetInfo, scope) {
              // create the widget
              var widget = productSpecificAnimation.getWidgetHtml(widgetInfo);

              addWidget(element, widget, scope);

              // calculate widget position based on the widget container
              var panelsContainer = element.closest('.selection-panels');
              var firstWidget = panelsContainer.find('.selection-panel:first-child .widget-container');
              var top = productSpecificAnimation.getFirstWidgetTop(firstWidget);
              var left = calcPanelViewportWidth(panelsContainer, true);
              var width = firstWidget.outerWidth();

              widget.css({left: left, top: top, position: 'absolute', width: width});
              return widget;
          };

          var addWidget = function (element, widget, scope) {
              element.closest('.selection-panel').append($compile(widget)(scope));


              // Get the current view index
              var currViewIndex = getCurrentPageNum();
              // Create a click function for this widget so when it is clicked, this will be triggered
              var onClickWidget = function () {
                  // We pass the index of the view where it was defined back to the animation function
                  // so we can expand the right panel and hide the rest
                  expandPanel(currViewIndex);
              };
              // Bind this widget(the big icon button)'s click event
              widget.bind('click', onClickWidget);
          };

          //===============================================================
          // Start the animation to show another view
          //===============================================================

          var isAnimating = false;
          var deferred = null;

          var startPanelTransition = function (widgetInfo, event, scope) {

              // panel transition
              deferred = $q.defer();
              var target = $(event.target);
              collapsePanel(target, widgetInfo, scope);
              if (!isAnimating) {
                  isAnimating = true;
              }
              return deferred.promise;
          };

          var calcPanelViewportWidth = function (panelsContainer, accumulateLastPanel) {
              var collapsedWidth = 0;
              var collapsedPanels = panelsContainer.find('.selection-panel.collapsed');

              collapsedPanels.each(function (i) {
                  if (i < collapsedPanels.length - 1 || i === collapsedPanels.length - 1 && accumulateLastPanel === true) {
                      collapsedWidth += $(this).outerWidth();
                  }
              });

              return Math.max($(document).outerWidth(), panelsContainer.outerWidth()) - collapsedWidth;
          };
          var calcTotalPanelWidth = function () {
              var width = 0;
              $('.selection-panel:visible').each(function () {
                  width += $(this).outerWidth(true);
              });
              return width;
          };

          var waitForTransition = function (property, elem, callback) {
              elem.on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function (e) {
                  if (e.originalEvent.propertyName === property) {
                      elem.off('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');
                      // make the callback executed asynchronously to prevent cross-browser issues
                      setTimeout(function () {
                          callback();
                      }, 0);
                  }
              });
          };

          var adjustScrollbar = function (panel, containerWidth, callback) {
              var sidePanel = $('#side-header');
              panel.closest('.scrollable-container').animate({
                  scrollLeft: (containerWidth - $(window).outerWidth() +
                  ((sidePanel) ? sidePanel.outerWidth() : 0))
              }, 500, callback);
          };

          // slides in the next panel
          var moveOut = function (selectionPanel) {
              var panelHeight = productSpecificAnimation.calcCollapsedPanelHeight();
              // fade the panel out
              selectionPanel.css('width', (selectionPanel.outerWidth() + 1) + 'px');
              selectionPanel.addClass('collapse');
              waitForTransition('opacity', selectionPanel, function () {
                  // need to set the container height first to avoid animation issues
                  var selectionPanelContainer = selectionPanel.closest('.selection-panels');
                  selectionPanelContainer.css('height', panelHeight + 'px');

                  selectionPanel
                    .removeClass('collapse')
                    .removeClass('expanded')
                    .addClass('collapsed');

                  var nextPanel = selectionPanel.next();
                  nextPanel.addClass('expand');

                  // fade the new panel in
                  waitForTransition('width', selectionPanel, function () {
                      nextPanel
                        .removeClass('expand')
                        .addClass('expanded');

                      // adjust the container width
                      var containerWidth = calcTotalPanelWidth();
                      selectionPanelContainer.css('width', containerWidth + 'px');

                      // animate the scrollbar
                      adjustScrollbar(selectionPanel, containerWidth);

                      // make sure Foundation widgets rendered correctly
                      $(document).foundation('reflow');

                      //this tells the productPanel directives to resize their text
                      $rootScope.$broadcast('animation:finished');
                      waitForTransition('opacity', nextPanel, function () {
                          isAnimating = false;
                      });
                  });
              });
          };

          // slides the old panel back in
          var moveIn = function (selectionPanel, elem, elemType, hideMultiplePanels) {
              //fix issues with the page watch for titles not triggering on backwards navigation
              //tell some ordering steps to reset themselves
              $rootScope.$broadcast('animation:back');

              var lastPanel = selectionPanel.siblings('.expanded'),
                inbetweenPanels = selectionPanel.nextAll('.collapsed');
              // fade the panel out
              lastPanel.removeClass('expanded').addClass('expand');

              if (hideMultiplePanels === true) {
                  // fade the collapsed panels out
                  inbetweenPanels.addClass('expand');
              }

              waitForTransition('opacity', lastPanel, function () {
                  // clean up states
                  lastPanel.removeClass('expand');
                  inbetweenPanels.removeClass('expand').removeClass('collapsed').css('width', 'auto').find('.widget-container').remove();

                  if (elemType === 'iconic') {
                      // widget position needs to be updated to accomodate for the expanded panel (original left
                      // position was set when the current panel was hidden)
                      elem.css({left: calcPanelViewportWidth(elem.closest('.selection-panels'), false)});
                  }

                  // expand the previous panel
                  selectionPanel.removeClass('collapsed').addClass('expand');

                  // fade the content in
                  waitForTransition('width', selectionPanel, function () {
                      selectionPanel
                        .removeClass('expand')
                        .addClass('expanded');

                      // animate the scrollbar and adjust the container width
                      var containerWidth = calcTotalPanelWidth();
                      adjustScrollbar(selectionPanel, containerWidth, function () {
                          selectionPanel.closest('.selection-panels').css({width: containerWidth + 'px'});
                      });

                      // make sure Foundation widgets rendered correctly
                      $(document).foundation('reflow');

                      //this tells the productPanel directives to resize their text
                      $rootScope.$broadcast('animation:finished');
                      waitForTransition('opacity', selectionPanel, function () {
                          isAnimating = false;
                          elem.remove();
                      });
                  });
              });
          };

          //moving forwards: collapse current selection panel
          var collapsePanel = function (element, widgetInfo, scope) {

              //product-specific 'jiggle' of window to re-do/correct height calculation
              // (in case devTools was open) before animation forward begins
              productSpecificAnimation.adjustWindowHeight();

              // create the widget
              var widget = createWidget(element, widgetInfo, scope);

              // save the state and start the animation
              var view = element.closest('.selection-panel');
              pushState({
                  elem:     widget,
                  elemType: widgetInfo.type,
                  view:     view
              });
              //this promise resolves as soon as the correct page number is set,
              //to make sure we take the right title and display it a little early
              deferred.resolve();
              moveOut(view);
          };

          //moving backward: will re-expand collapsed panel on widget click for that panel
          var expandPanel = function (pageNumber) {

              //product-specific 'jiggle' of window to re-do/correct height calculation
              // (in case devTools was open) before animation forward begins
              productSpecificAnimation.adjustWindowHeight();

              if (!isAnimating) {
                  isAnimating = true;

                  // animation needs to know if multiple states are popped
                  var hideMultiple = getCurrentPageNum() - pageNumber > 1;

                  // restore the state and start the animation
                  var state = popState(pageNumber);
                  moveIn(state.view, state.elem, state.elemType, hideMultiple);
              }
          };

          var pageStates = [];

          var pushState = function (data) {
              pageStates.push(data);
          };

          var popState = function (stateNumber) {
              var pageState;
              do {
                  pageState = pageStates.pop();
              } while (pageStates.length > stateNumber);

              return pageState;
          };

          var clearState = function () {
              pageStates = [];
          };

          var getCurrentPageNum = function () {
              return pageStates.length;
          };

          return {
              startPanelTransition: startPanelTransition,
              initialize:           clearState,
              getCurrentPage:     getCurrentPageNum,
              adjustWindowHeight: productSpecificAnimation.adjustWindowHeight,
              isAnimating: function () {
                return isAnimating;
              }
          }
      }])
  .factory('productSpecificAnimation', ['CONST', 'adjustWindowHeightFactory', function (CONST, adjustWindowHeightFactory) {

      //small differences needed in some animation variables per-product

      var whiteLabelAnimationSettings = {
          adjustWindowHeight: function () {
              adjustWindowHeightFactory($('#ordering-header'), $('#ordering-scrollable-container'));
          },

          calcCollapsedPanelHeight: function () {
              return Math.max($('.selection-panel.collapsed').outerHeight(), $('.selection-panel:first-child').outerHeight());
          },
          getWidgetHtml:            function (widgetInfo) {
              var widget = {};

              var shrinkToFit = (widgetInfo.shrinkToFit) ? 'class="svg-max-bound" ' : '';

              if (widgetInfo.iconTextUnit != null && widgetInfo.iconTextValue != null) {
                  widget = $('<div class="widget-container selection"><h6 translate>' + widgetInfo.iconTitle + '</h6><div class="panel-container"><div class="circle"><div class="svg-table"><div class="panel-svg"><div class="svg-text-container"><div class="svg-panel-title">' + widgetInfo.iconTextValue + '</div><div class="svg-panel-text">' + widgetInfo.iconTextUnit + '</div></div><div cv-svg-import ' + shrinkToFit + ' svg-url="\'' + widgetInfo.iconName + '\'"></div></div></div></div></div>');
              } else {
                  widget = $('<div class="widget-container selection"><h6 translate>' + widgetInfo.iconTitle + '</h6><div class="panel-container"><div class="circle"><div class="svg-table"><div class="panel-svg"><div cv-svg-import ' + shrinkToFit + ' svg-url="\'' + widgetInfo.iconName + '\'"></div></div></div></div></div>');
              }
              return widget;
          },
          getFirstWidgetTop:        function () {
              return 0;
          }
      };

      var dtAnimationSettings = {
          adjustWindowHeight:       function () {
              adjustWindowHeightFactory();
          },
          calcCollapsedPanelHeight: function () {
              var scrollContainer = $('#ordering-scrollable-container');
              return Math.max($('.selection-panel.collapsed').outerHeight(), $('.selection-panel:first-child').outerHeight(), scrollContainer.outerHeight());
          },
          getWidgetHtml:            function (widgetInfo) {
              return $('<div class="widget-container panel selection"><div class="title"><h6 translate>' + widgetInfo.iconTitle + '</h6></div><div class="' + widgetInfo.iconName + '"></div><span class="status-icon cv-icon-checkmark"></span></div>');
          },
          getFirstWidgetTop:        function (firstWidget) {
              return firstWidget.position().top
          }
      };

      var productSpecificAnimation = {};
      switch (CONST.PRODUCT_TYPE) {
          case 'WHITE_LABEL':
              productSpecificAnimation = whiteLabelAnimationSettings;
              break;
          case 'DT':
              productSpecificAnimation = dtAnimationSettings;
              break;
      }

      return productSpecificAnimation;
  }]);
