/**
 * Copyright (c) 2010 Jakob Westhoff <jakob@westhoffswelt.de>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function( $ ) {
    /**
     * Ecapsulate an event handling function to support one finger
     * touchevents as well as mouseevents using the same event data
     * structure.
     */
    function encapsulateTouchEvent( fn ) {
        // Copy touch event data from one structure to another
        var copyTouchEventData = function( source, target ) {
            $.each( ['client', 'screen', 'page'], function( i, name ) {
                $.each( ['X', 'Y'], function( i, axis ) {
                    target[name + axis] = source[name + axis];
                });
            });
            $.each( ['target', 'identifier'], function( i, name ) {
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
    } 
    
    /**
     * Determine if the current browser is capable of handling touch events
     * at all. 
     *
     * Therefore mouse events can be used on normal systems
     */
    function isTouchCapable() {
        var e = null;
        try {
            e = document.createEvent( 'TouchEvent' );
            return true;
        } catch( exception ) {
            return false;
        }
    }

    /** 
     * Extract the x and y movement out of the targets -webkit-transform
     * property
     */
    function extractMovement( target ) {
        var textual = target.css( '-webkit-transform' ),
            re = /^translate3d\((-?[0-9.]+)[^0-9-]+(-?[0-9.]+).+$/,
            matches = re.exec( textual ); 

        // If the value ist not initialized return 0,0
        if ( matches === null ) {
            return {
                x: 0,
                y: 0
            };
        }

        return {
            x: parseFloat( matches[1] ),
            y: parseFloat( matches[2] )
        };
    }

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
    function calculateScrollBorder( containerSize, contentSize, movement ) {
        if ( movement > 0 ) {
            // Scroll over at the beginning
            return Math.floor( -1 * movement );
        }

        if ( -1 * movement + containerSize > contentSize ) {
            return Math.ceil( -1 * movement + containerSize - contentSize );  
        }

        return 0;
    }

    /**
     * Scroll the target element by a certain amount on the X and Y axis
     * inside its container and return X and Y Axis scrolling borders
     *
     * Furthermore the rubber band effect while reaching the border will be
     * controlled here.
     */
    function scrollBy( target, left, top ) {
        var oldPosition = extractMovement( target ),
            containerWidth = target.parent().innerWidth(),
            containerHeight = target.parent().innerHeight(),
            contentWidth = target.innerWidth(), 
            contentHeight = target.innerHeight(), 
            oldBorder  = {
                'x': calculateScrollBorder( containerWidth, contentWidth, oldPosition.x ),
                'y': calculateScrollBorder( containerHeight, contentHeight, oldPosition.y )
            },
            newBorder = {
                'x': calculateScrollBorder( containerWidth, contentWidth, oldPosition.x - left ),
                'y': calculateScrollBorder( containerHeight, contentHeight, oldPosition.y - top )
            };

        // Size down movement relative to the border offset if the border
        // is increasing
        if ( Math.abs( newBorder.y ) > Math.abs( oldBorder.y ) ) {
            top *= 1 / Math.log( Math.abs( newBorder.y ) );
        }
        if ( Math.abs( newBorder.x ) > Math.abs( oldBorder.x ) ) {
            left *= 1 / Math.log( Math.abs( newBorder.x ) );
        }

        target.css( 
            '-webkit-transform',
            'translate3d(' + ( oldPosition.x - left ) + 'px,' + ( oldPosition.y - top ) + 'px,0)'
        );

        return newBorder;
    }


        /**
         * Data store which may be used to store arbitrary data and apply
         * certain operation on it.
         *
         * This storage is no real object (in the sense of OO), as its operations
         * work on all different kinds of input data. Therefore they strictly do
         * not belong together as methods of one class.
         */
    var store = {
            /**
             * Initialize a new data store
             *
             * An initial value may be supplied. If none is given 0 is assumed as
             * default.
             */
            init: function( initial ) {
                var storageValue = initial || 0;

                /**
                 * Function to apply a certain operation onto value stored inside
                 * the current data store
                 */
                return function( op ) {
                    // Do nothing, if no operation is provided
                    if ( op === undefined ) {
                        op = store.noop;
                    }
                    
                    return ( storageValue = op( storageValue ) );  
                }
            },

            /**
             * Apply no operation to a data store
             */
            noop: function( v ) {
                return v;
            },

            /**
             * Set data store to a new value
             */
            set: function( value ) {
                return function( oldValue ) {
                    return value;
                }
            },

            /**
             * Add a value to the current data store value
             */
            add: function( value ) {
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
            converge: function( value, border ) {
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
            tightenRubberband: function( border, factor ) {
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
            }
        },

        
        /**
         * The next three variables contain the correct event strings to be
         * registered for either touch or mouse handling. Whatever is currently
         * available
         */
        touchstart = isTouchCapable() ? 'touchstart.kinetic' : 'mousedown.kinetic',
        touchmove  = isTouchCapable() ? 'touchmove.kinetic' : 'mousemove.kinetic',
        touchend   = isTouchCapable() ? 'touchend.kinetic' : 'mouseup.kinetic',
        
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
            directions: {x: true, y: true},
            background: 'red',
            width: '400px',
            height: '400px'
        }, options );
        
        // Handle element sets correctly
        this.each( function() {
            var velocityX = store.init( 0 ),
                velocityY = store.init( 0 ),
                rubberband = store.init( { x: 0, y: 0 } ),
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
                        'border': '1px solid orange'
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
                    rubberband( store.tightenRubberband( scrollBy( 
                        target, 
                        options.directions.x ? lastTouch.x - currentTouch.x : 0, 
                        options.directions.y ? lastTouch.y - currentTouch.y : 0
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
                if ( options.directions.x ) {
                    velocityX( 
                        store.set( ( endTouch.x - startTouch.x ) / ( endTouch.time - startTouch.time ) ) 
                    );
                }

                if( options.directions.y ) {
                    velocityY( 
                        store.set( ( endTouch.y - startTouch.y ) / ( endTouch.time - startTouch.time ) ) 
                    );
                }

                // The movementTimer takes care of moving the content along,
                // while decelerating it constantly until it stops.
                if ( movementTimer == null ) {
                    movementTimer = setInterval( function() {
                        var velocity = {
                                x: velocityX() * options.resolution,
                                y: velocityY() * options.resolution
                            },
                            newVelocity = {
                                x: velocityX( store.converge( options.deceleration + Math.abs( rubberband().x * options.rubberband ) ) ),
                                y: velocityY( store.converge( options.deceleration + Math.abs( rubberband().y * options.rubberband ) ) )
                            },
                            // As long as there is a kinetic movement the
                            // rubberband snap back velocity is ignored. Sized down
                            // movement is handled by the scrollBy function
                            movement = {
                                x: velocity.x !== 0 ? velocity.x : rubberband().x,
                                y: velocity.y !== 0 ? velocity.y : rubberband().y
                            };

                        rubberband( store.tightenRubberband( scrollBy( 
                            target, 
                            -1 * movement.x, 
                            -1 * movement.y  
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
