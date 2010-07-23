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
         * Converge against zero by the given value.
         *
         * If the current value is negative the new value will be added
         * otherwise it will be substracted.
         *
         * If the new would cross the zero border 0 is the new value set. 
         */
        converge = function( value ) {
            return function( oldValue ) {
                var newValue = ( oldValue > 0 ) ? ( oldValue - value ) : ( oldValue + value );
                // Check if the value flipped from positive to negative or vice
                // versa
                return ( oldValue * newValue > 0 ) ? newValue : 0;
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
                    target.css({
                        'top': 
                            parseInt( target.css( "top" ) ) - ( lastTouch.y - currentTouch.y ) + "px",
                        'left':
                            parseInt( target.css( "left" ) ) - ( lastTouch.x - currentTouch.x ) + "px",
                    });

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
                    // No movement required
                    console.log( "timeframe to small" );
                    return;
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
                        target.css({
                            'top':
                                 Math.floor( parseInt( target.css( 'top' ) ) + velocityY() * options.resolution ) + 'px',
                            'left':
                                 Math.floor( parseInt( target.css( 'left' ) ) + velocityX() * options.resolution )  + 'px'
                        });

                        // Decelerate the movement constantly every step
                        var newVelocityX = velocityX( converge( options.deceleration ) ),
                            newVelocityY = velocityY( converge( options.deceleration ) );

                        if ( newVelocityX === 0 && newVelocityY === 0 ) {
                            clearInterval( movementTimer );
                            movementTimer = null;
                        }
                    }, options.resolution );
                }
            }) );
        });
    }
})( jQuery );
