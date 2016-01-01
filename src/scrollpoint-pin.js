angular.module('ui.scrollpoint.pin', ['ui.scrollpoint'])
.factory('ui.scrollpoint.Pin', function(){

    var Pin = {
        pinned: function(pin, edge){
            Pin.Stack.pinned(pin, edge);
        },
        unpinned: function(pin, edge){
            Pin.Stack.unpinned(pin, edge);
        },

        Stack: {
            onWindow: {
                items: [],
                stacked: {}
            },
            pinned: function(pin, edge){
                if(pin.stack){
                    if(pin.stack.items){
                        var stackIdx = pin.stack.items.indexOf(pin);
                        //console.log('Stack PINNED ON ['+((pin.stack==this.onWindow)?'window':'target')+'] @ ('+stackIdx+' / '+(pin.stack.items.length-1)+') @ '+edge);
                    }
                    if(pin.stack.stacked){
                        if(angular.isUndefined(pin.stack.stacked[edge])){
                            pin.stack.stacked[edge] = [];
                        }
                        var stackIdx = pin.stack.stacked[edge].indexOf(pin);
                        if(stackIdx == -1){
                            pin.stack.stacked[edge].push(pin);
                            console.log('Stack PINNED ON ['+((pin.stack==this.onWindow)?'window':'target')+']['+edge+'] @ '+(pin.stack.stacked[edge].length-1));
                        }
                    }
                }
            },
            unpinned: function(pin, edge){
                if(pin.stack){
                    if(pin.stack.items){
                        var stackIdx = pin.stack.items.indexOf(pin);
                        //console.log('Stack UNPINNED FROM ['+((pin.stack==this.onWindow)?'window':'target')+'] @ ('+stackIdx+' / '+(pin.stack.items.length-1)+') @ '+edge);
                    }
                    if(pin.stack.stacked && pin.stack.stacked[edge]){
                        var stackIdx = pin.stack.stacked[edge].indexOf(pin);
                        if(stackIdx != -1){
                            pin.stack.stacked[edge].splice(stackIdx, 1);
                            console.log('Stack UNPINNED FROM ['+((pin.stack==this.onWindow)?'window':'target')+']['+edge+'] @ '+stackIdx);
                        }
                    }
                }
            },
            register: function(pin){
                var stack;
                if(pin.$uiScrollpoint && pin.$uiScrollpoint.hasTarget && pin.$uiScrollpoint.$target){
                    if(angular.isUndefined(pin.$uiScrollpoint.$target.stack)){
                        pin.$uiScrollpoint.$target.stack = {
                            items: [],
                            stacked: {}
                        };
                    }
                    stack = pin.$uiScrollpoint.$target.stack;
                }
                else{
                    stack = this.onWindow;
                }
                // assign the stack to the pin
                pin.stack = stack;
                if(pin.stack){
                    if(pin.stack.items){
                        if(pin.stack.items.indexOf(pin) == -1){
                            // append the pin to the stack
                            pin.stack.items.push(pin);
                            console.log('REGISTERED on ['+((pin.stack==this.onWindow)?'window':'target')+'] @ '+(pin.stack.items.length-1));
                        }
                    }
                }
            },
            unregister: function(pin){
                if(pin.stack){
                    if(pin.stack.items){
                        var stackIdx = pin.stack.items.indexOf(pin);
                        if(stackIdx != -1){
                            pin.stack.items.splice(stackIdx, 1);
                            console.log('UNREGISTER FROM ['+((pin.stack==this.onWindow)?'window':'target')+'] @ '+stackIdx);
                        }
                    }
                    pin.stack = undefined;
                }
            }
        }
    };
    return Pin;
})
.directive('uiScrollpointPin', ['ui.scrollpoint.Pin', '$timeout', function(Pin, $timeout){
    return {
        restrict: 'A',
        priority: 100,
        require: ['uiScrollpoint', 'uiScrollpointPin'],
        controller: ['ui.scrollpoint.Pin', function(Pin){
            var self = this;
            this.$element = undefined;
            this.$placeholder = undefined;
            this.$uiScrollpoint = undefined;

            this.edge = undefined;
            this.offset = {};

            var origCss = {};
            var pinToTarget = false;

            this.repositionPinned = function(){
                if(self.$placeholder && self.$uiScrollpoint){
                    var scrollOffset = self.$uiScrollpoint.hasTarget ? 0 : self.$uiScrollpoint.getScrollOffset();
                    self.$element.css('left', (self.offset.x)+'px');
                    self.$element.css('top', (scrollOffset-self.offset.y)+'px');
                }
            };

            this.setElement = function(element){
                this.$element = element;
            };
            this.setScrollpoint = function(uiScrollpoint){
                this.$uiScrollpoint = uiScrollpoint;
            };

            this.pin = function(edge, distance){
                if(!this.$placeholder && this.$element && this.$uiScrollpoint){
                    // calculate the offset for its absolute positioning
                    this.offset.x = this.$element[0].offsetLeft;
                    this.offset.y = this.$uiScrollpoint.getScrollOffset() - this.$element[0].offsetTop - distance * ((edge == 'bottom')?-1.0:1.0);

                    // create an invisible placeholder
                    this.$placeholder = this.$element.clone();
                    this.$placeholder.addClass('placeholder');
                    this.$placeholder.css('visibility', 'hidden');
                    this.$element.after(this.$placeholder);

                    // pin to ui-scrollpoint-target if the parent is not the target
                    pinToTarget = (this.$uiScrollpoint.hasTarget && this.$uiScrollpoint.$target != this.$element.parent());
                    if(pinToTarget){
                        var bounds = this.$element[0].getBoundingClientRect();
                        var targetBounds = this.$uiScrollpoint.$target[0].getBoundingClientRect();

                        this.offset.x = bounds.left;
                        this.offset.y = -(this.$uiScrollpoint.$target[0].offsetTop) - (bounds.top-targetBounds.top+distance);

                        if(edge == 'bottom'){
                            this.offset.y = -(this.$uiScrollpoint.$target[0].offsetTop) - this.$uiScrollpoint.$target[0].offsetHeight + this.$element[0].offsetHeight - (bounds.bottom-targetBounds.bottom-distance);
                        }

                        this.$uiScrollpoint.$target.append(this.$element);
                    }

                    // save the css properties that get modified by pinning functions
                    origCss.position = this.$element[0].style.position; //element.css('position');
                    origCss.top = this.$element[0].style.top; //element.css('top');
                    origCss.left = this.$element[0].style.left; //element.css('left');
                    origCss.width = this.$element[0].style.width;


                    // lock the width at whatever it is before pinning (since absolute positioning could take it out of context)
                    this.$element.css('width', this.$element[0].offsetWidth+'px');

                    // pin the element
                    this.$element.addClass('pinned');
                    this.$element.css('position', 'absolute');

                    // keep track of which edge
                    this.edge = edge;

                    // adjust the element's absolute top whenever target scrolls
                    this.$uiScrollpoint.$target.on('scroll', self.repositionPinned);
                    self.repositionPinned();

                    // notify the Pin service that it is pinned
                    Pin.pinned(this, edge);
                }
            };

            this.unpin = function(){
                if(this.$placeholder && this.$element && this.$uiScrollpoint){

                    // stop adjusting absolute position when target scrolls
                    this.$uiScrollpoint.$target.off('scroll', self.repositionPinned);

                    // reset element to unpinned state
                    this.$element.removeClass('pinned');
                    for(var prop in origCss){
                        this.$element.css(prop, origCss[prop]);
                    }

                    if(pinToTarget){
                        this.$placeholder.after(this.$element);
                    }

                    var edge = this.edge;
                    this.edge = undefined;

                    this.offset = {};

                    // destroy the placeholder
                    this.$placeholder.remove();
                    this.$placeholder = undefined;

                    this.$uiScrollpoint.cachePosition();

                    // notify the Pin service that it is unpinned
                    Pin.unpinned(this, edge);
                }
            };

        }],
        link: function (scope, elm, attrs , Ctrl){
            var uiScrollpoint = Ctrl[0];
            var uiScrollpointPin = Ctrl[1];

            // setup the controller
            uiScrollpointPin.setElement(elm);
            uiScrollpointPin.setScrollpoint(uiScrollpoint);

            // default behaviour is to stack - use ui-scrollpoint-pin-overlay="true" to disable stacking
            if(angular.isUndefined(attrs.uiScrollpointPinOverlay)){
                Pin.Stack.register(uiScrollpointPin);
            }
            attrs.$observe('uiScrollpointPinOverlay', function(uiScrollpointPinOverlay){
                if(!uiScrollpointPinOverlay){
                    uiScrollpointPinOverlay = true;
                }
                else{
                    uiScrollpointPinOverlay = scope.$eval(uiScrollpointPinOverlay);
                }

                if(!uiScrollpointPinOverlay){
                    // register to stack if it is not overlaying
                    Pin.Stack.register(uiScrollpointPin);
                }
                else{
                    // unregister from stack if it is overlaying
                    Pin.Stack.unregister(uiScrollpointPin);
                }
            });

            attrs.$observe('uiScrollpointAbsolute', function(scrollpointAbsolute){
                // absolute could change the target, so unregister from its existing stack
                Pin.Stack.unregister(uiScrollpointPin);

                // on next digest cycle, register on whatever its new stack should be
                $timeout(function(){
                    Pin.Stack.register(uiScrollpointPin);
                })
            });

            attrs.$observe('uiScrollpointEnabled', function(scrollpointEnabled){
                scrollpointEnabled = scope.$eval(scrollpointEnabled);
                if(!scrollpointEnabled){
                    // unpin the element if scrollpoint is disabled
                    uiScrollpointPin.unpin();

                    // unregister from its stack
                    Pin.Stack.unregister(uiScrollpointPin);
                }
            });

            // create a scrollpoint action that pins the element
            uiScrollpoint.addAction(function(distance, element, edge){
                if(distance >= 0 && !uiScrollpointPin.$placeholder){
                    uiScrollpointPin.pin(edge, distance);
                }
                else if(distance < 0 && uiScrollpointPin.$placeholder){
                    uiScrollpointPin.unpin();
                }
            });
        }
    };
}]);
