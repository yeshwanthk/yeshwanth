angular.module('appVPN').config(function($provide) {
    $provide.decorator('nvd3SparklineChartDirective', function($delegate) {
        var directive = $delegate[0];

        var link = directive.link;
        directive.compile = function() {
            return function(scope, element, attrs) {
                link.apply(this, arguments);

                scope.$watch('data', function (data) {
                    if (data) {
                        setTimeout(function() {
                        	//console.log(d3.y, d3.yScale);
                            var y = d3.yScale(),
                                yTickFormat = d3.format(',.2f');

                            var valueWrap = d3.select(element.find('.nv-valueWrap')[0]),
                                firstValue = d3.y()(data[0], 0);

                            //console.log(firstValue);

                            var value = valueWrap.selectAll('.nv-startValue')
                                    .data(firstValue);

                            value.enter().append('text').attr('class', 'nv-startValue')
                                .attr('dx', -8)
                                .attr('dy', '.9em')
                                .style('text-anchor', 'end');

                            value
                                .attr('x', 0)
                                .attr('y', function(d) { return y(d); })
                                .text(yTickFormat(firstValue));
                        }, 0);
                    }
                });
            };
        };
        return $delegate;
    });
});
