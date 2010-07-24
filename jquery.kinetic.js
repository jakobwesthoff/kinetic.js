/**
 * Copyright (c) 2010 Jakob Westhoff <jakob@westhoffswelt.de>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function( $ ) {
        /**
         * Apply no operation to a data store
         */
    var noop = function( v ) {
            return v;
        },

        /**
         * Set data store to a new value
         */
        set = function( value ) {
            return function( oldValue ) {
                return value;
            }
        },
        
        /**
         * Add a value to the current data store value
         */
        add = function( value ) {
            return function( oldValue ) {
                return oldValue + value;
            }
        },
        
        /**
         * Converge to a certain bound by the given value.
         *
         * If the current value is left of new value will be substracted
         * otherwise added.
         *
         * If the new value would cross the border the border is the new value
         * set.
         *
         * If no border is given 0 is assumed 
         */
        converge = function( value, border ) {
            border = border || 0;

            return function( oldValue ) {
                var newValue = ( oldValue > border ) ? ( oldValue - value ) : ( oldValue + value );
                // Check if the value flipped
                return ( ( oldValue - border ) * ( newValue - border ) > 0 ) ? newValue : border;
            }
        },

        /**
         * Modify the value store holding the rubber band velocity by using new
         * border values, to calculate the new force to be applied.
         */
        tightenRubberband = function( border, factor ) {
            return function( oldRubberband ) {
                var rubberband = {x: 0, y:0};

                if ( border.x !== 0 ) {
                    rubberband.x = border.x * factor;
                }

                if ( border.y !== 0 ) {
                    rubberband.y = border.y * factor;
                }

                return rubberband;
            }
        },
        
        /**
         * Initialize a new data store
         *
         * Different kinds of operations can be applied to a datastore.
         */
        __store = function( initial ) {
            var storageValue = initial || 0;

            /**
             * Function to apply a certain operation onto value stored inside
             * the current data store
             */
            return function( op ) {
                // Do nothing, if no operation is provided
                if ( op === undefined ) {
                    op = noop;
                }
                
                return ( storageValue = op( storageValue ) );  
            }
        },
        
        /**
         * Ecapsulate an event handling function to support one finger
         * touchevents as well as mouseevents using the same event data
         * structure.
         */
        encapsulateTouchEvent = function( fn ) {
            // Copy touch event data from one structure to another
            var copyTouchEventData = function( source, target ) {
                $.each( ["client", "screen", "page"], function( i, name ) {
                    $.each( ["X", "Y"], function( i, axis ) {
                        target[name + axis] = source[name + axis];
                    });
                });
                $.each( ["target", "identifier"], function( i, name ) {
                    target[name] = source[name];
                });
            };
             
            return function( e ) {
                // Transport variable to pass return values from within a inner
                // closure to the outer scope
                var returnValue = undefined;

                switch( e.type )  {
                    case 'mousedown':
                    case 'mouseup':
                    case 'mousemove':
                        e.preventDefault();
                        // Mouse events can simply be passed through
                        return fn( e );
                    case 'touchstart':
                        // Only the first finger is used for touch handling
                        if ( e.originalEvent.touches.length !== 1 ) {
                            return;
                        }

                        // Save the touch id for later identification
                        firstFingerId = e.originalEvent.touches[0].identifier;
                        copyTouchEventData( e.originalEvent.touches[0], e );
                        return fn ( e );
                    case 'touchmove':
                        // Make sure the first finger has been moved
                        $.each( e.originalEvent.touches, function( i, touch ) {
                            if ( touch.identifier === firstFingerId ) {
                                copyTouchEventData( touch, e );
                                returnValue = fn( e );
                                // End the $.each
                                return false;
                            }
                        });
                        return returnValue;
                    case 'touchend':
                        // Ensure the last finger has been lifted
                        if ( e.originalEvent.changedTouches.length > 1 ) {
                            return;
                        }
                        
                        // Make sure the first finger has been lifted
                        $.each( e.originalEvent.changedTouches, function( i, touch ) {
                            if ( touch.identifier === firstFingerId ) {
                                copyTouchEventData( touch, e );
                                returnValue = fn( e );
                                // End the $.each
                                return false;
                            }
                        });
                        return returnValue;
                }
            }
        }, 
        
        /**
         * Determine if the current browser is capable of handling touch events
         * at all. 
         *
         * Therefore mouse events can be used on normal systems
         */
        isTouchCapable = function() {
            var e = null;
            try {
                e = document.createEvent( "TouchEvent" );
                return true;
            } catch( exception ) {
                return false;
            }
        },

        /**
         * Calculate the scroll over offset based on container length, content
         * length and movement offset.
         *
         * This function can be used to calculate X as well as Y Axis offsets.
         *
         * A negative value indicates a scroll offset on the begin of the
         * content, while a positive value indicates an offset on the end.
         *
         * A zero return value indicates the content fits nicely inside the
         * current container.
         */
        calculateScrollBorder = function( containerSize, contentSize, movement ) {
            if ( movement > 0 ) {
                // Scroll over at the beginning
                return Math.floor( -1 * movement );
            }

            if ( -1 * movement + containerSize > contentSize ) {
                return Math.ceil( -1 * movement + containerSize - contentSize );  
            }

            return 0;
        },

        /**
         * Scroll the target element by a certain amount on the X and Y axis
         * inside its container and return X and Y Axis scrolling borders
         *
         * Furthermore the rubber band effect while reaching the border will be
         * controlled here.
         */
        scrollBy = function( target, left, top ) {
            var oldTop  = parseFloat( target.css( "top" ) ),
                oldLeft = parseFloat( target.css( "left" ) ),
                containerWidth = target.parent().innerWidth(),
                containerHeight = target.parent().innerHeight(),
                contentWidth = target.innerWidth(), 
                contentHeight = target.innerHeight(), 
                oldBorder  = {
                    'x': calculateScrollBorder( containerWidth, contentWidth, oldLeft ),
                    'y': calculateScrollBorder( containerHeight, contentHeight, oldTop )
                },
                newBorder = {
                    'x': calculateScrollBorder( containerWidth, contentWidth, oldLeft - left ),
                    'y': calculateScrollBorder( containerHeight, contentHeight, oldTop - top )
                };

            // Size down movement relative to the border offset if the border
            // is increasing
            if ( Math.abs( newBorder.y ) > Math.abs( oldBorder.y ) ) {
                top  *= 1 / Math.log( Math.abs( newBorder.y ) );
            }
            if ( Math.abs( newBorder.x ) > Math.abs( oldBorder.x ) ) {
                left *= 1 / Math.log( Math.abs( newBorder.x ) );
            }

            target.css({
                'top': oldTop - top + "px",
                'left': oldLeft - left + "px"
            });

            return newBorder;
        },
        
        /**
         * The next three variables contain the correct event strings to be
         * registered for either touch or mouse handling. Whatever is currently
         * available
         */
        touchstart = isTouchCapable() ? "touchstart.kinetic" : "mousedown.kinetic",
        touchmove  = isTouchCapable() ? "touchmove.kinetic" : "mousemove.kinetic",
        touchend   = isTouchCapable() ? "touchend.kinetic" : "mouseup.kinetic",
        
        /**
         * The id of the first finger which touched the display needs to be
         * stored across all events
         */
        firstFingerId = null;




    /**
     * Register the plugin jQuery function
     */
    $.fn.kinetic = function( options ) {
        options = $.extend({
            deceleration: 0.03,            
            rubberband: 0.15,
            resolution: 13,
            touchsamples: 500,
            accumulationTime: 200,
            background: 'red',
            width: "400px",
            height: "400px"
        }, options );
        
        // Handle element sets correctly
        this.each( function() {
            var velocityX = __store( 0 ),
                velocityY = __store( 0 ),
                rubberband = __store( { x: 0, y: 0 } ),
                lastTouches = null;
                movementTimer = null,
                target = $(this),
                /**
                 * Container element to position the content absolute inside it
                 */
                container = $( '<div />', {
                    css: {
                        'position': 'relative',
                        'overflow': 'hidden',
                        'width': options.width,
                        'height': options.height,
                        'background': options.background,
                        'border': "1px solid orange"
                    }
                });

            target.css({
                'position': 'absolute',
                'top': '0px',
                'left': '0px'
            }).wrap( container );

            // Update the container to the real DOM element instead of the
            // generated one
            container = target.parent();

            /**
             * Handle initial data gathering the moment a finger touches the
             * screen
             */
            container.bind( touchstart, encapsulateTouchEvent( function( e ) {
                // Stop all running movements
                if ( movementTimer !== null ) {
                    clearInterval( movementTimer );
                    movementTimer = null;
                }

                lastTouches = [{
                    'time': e.timeStamp,
                    'x': e.pageX,
                    'y': e.pageY
                }];


                /**
                 * Check and react to movement, while a finger is down on the
                 * screen
                 */
                container.bind( touchmove, encapsulateTouchEvent( function( e ) {
                    var lastTouch = lastTouches[lastTouches.length - 1],
                        currentTouch = null;


                    lastTouches.push( 
                        currentTouch = {
                            'time': e.timeStamp,
                            'x': e.pageX,
                            'y': e.pageY
                        }
                    );

                    // Scroll by given movement
                    rubberband( tightenRubberband( scrollBy( 
                        target, 
                        lastTouch.x - currentTouch.x, 
                        lastTouch.y - currentTouch.y 
                    ), options.rubberband ) );

                    // Only store configured amount of samples
                    if ( lastTouches.length > options.touchsamples ) {
                        lastTouches.shift();
                    }
                }) );
            }) );

            /**
             * Apply kinetic scrolling after the finger has been removed from
             * the screen
             */
            container.bind( touchend, encapsulateTouchEvent( function( e ) {                      
                var startTouch = null,
                    endTouch = null;

                // Movement does not need to be checked until the finger is down on
                // the display the next time
                container.unbind( touchmove );

                // Only accumulate movements not older than
                // options.accumulationTime
                $.each( lastTouches, function( i, touch ) {
                    if ( e.timeStamp - touch.time > options.accumulationTime )  {
                        return;
                    }
                    
                    if ( startTouch === null ) {
                        startTouch = touch;
                    } else {
                        endTouch = touch;
                    }
                });
                    
                if ( startTouch === null || endTouch === null ) {
                    // No kinetic movement needed, but the rubberband may still
                    // have some effect.
                    if ( rubberband().x === 0 && rubberband().y === 0 ) {
                        // No movement needed at all
                        return;
                    }

                    startTouch = {
                        x: 0, y: 0,
                        time: 0
                    };
                    endTouch = {
                        x: 0, y: 0,
                        time: 1
                    };
                }
                
                // Set the new velocity values calculated using the movement
                // which happened during the last moments of the touchmove
                // event
                velocityX( 
                    set( ( endTouch.x - startTouch.x ) / ( endTouch.time - startTouch.time ) ) 
                );

                velocityY( 
                    set( ( endTouch.y - startTouch.y ) / ( endTouch.time - startTouch.time ) ) 
                );

                // The movementTimer takes care of moving the content along,
                // while decelerating it constantly until it stops.
                if ( movementTimer == null ) {
                    movementTimer = setInterval( function() {
                        var velocity = {
                                x: velocityX() * options.resolution,
                                y: velocityY() * options.resolution
                            },
                            newVelocity = {};

                        // If the values cancel each other out set the kinetic
                        // velocity to 0. This is not 100% correct. But for the
                        // effect to look right it is enough.
                        if ( ( velocity.x > 0 && rubberband().x < 0 ) 
                          || ( velocity.x < 0 && rubberband().x > 0 ) ) {
                            newVelocity.x = velocityX( set( 0 ) );
                        } else {
                            newVelocity.x = velocityX( converge( options.deceleration ) );
                        }

                        if ( ( velocity.y > 0 && rubberband().y < 0 ) 
                          || ( velocity.y < 0 && rubberband().y > 0 ) ) {
                            newVelocity.y = velocityY( set( 0 ) );
                        } else {
                            newVelocity.y = velocityY( converge( options.deceleration ) );
                        }

                        rubberband( tightenRubberband( scrollBy( 
                            target, 
                            -1 * ( velocity.x + rubberband().x ), 
                            -1 * ( velocity.y + rubberband().y ) 
                        ), options.rubberband ) );

                        if ( newVelocity.x === 0 && newVelocity.y === 0 
                          && rubberband().x === 0 && rubberband().y === 0 ) {
                            clearInterval( movementTimer );
                            movementTimer = null;
                        }
                    }, options.resolution );
                }
            }) );
        });
    }
})( jQuery );
