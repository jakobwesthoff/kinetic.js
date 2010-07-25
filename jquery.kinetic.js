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
    function extractTransformTranslation( target ) {
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
        /**
         * Draw the scrollbars based on the current position of the content and
         * the calculated border values. 
         */
        function drawScrollbars( position, border ) {
            var containerDimensions = {
                    x: container.innerWidth(),
                    y: container.innerHeight()
                },
                contentDimensions = {
                    x: target.innerWidth(),
                    y: target.innerHeight()
                },
                scrollbarTranslations = {
                    x: extractTransformTranslation( scrollbars.x ),
                    y: extractTransformTranslation( scrollbars.y )
                },
                scrollbarLengths = {
                    x: Math.max( 
                        options.scrollbarSize * 2,
                        ( containerDimensions.x * containerDimensions.x / contentDimensions.x ) - Math.abs( border.x ) - options.scrollbarSize
                    ),
                    y: Math.max( 
                        options.scrollbarSize * 2,
                        ( containerDimensions.y * containerDimensions.y / contentDimensions.y ) - Math.abs( border.y ) - options.scrollbarSize
                    )
                },
                scrollbarMovements = {
                    x: ( border.x > 0 )
                       ? ( containerDimensions.x - options.scrollbarSize - scrollbarLengths.x )
                       : ( ( border.x < 0 )
                           ? ( 0 )
                           : ( Math.abs( position.x ) * containerDimensions.x / contentDimensions.x )
                         ),
                    y: ( border.y > 0 )
                       ? ( containerDimensions.y - options.scrollbarSize - scrollbarLengths.y )
                       : ( ( border.y < 0 )
                           ? ( 0 )
                           : ( Math.abs( position.y ) * containerDimensions.y / contentDimensions.y )
                         )
                };

            scrollbars.x.css({
                'width': scrollbarLengths.x + 'px',
                '-webkit-transform': 'translate3d(' + scrollbarMovements.x + 'px,' + scrollbarTranslations.x.y + 'px,0)'
            });

            scrollbars.y.css({
                'height': scrollbarLengths.y + 'px',
                '-webkit-transform': 'translate3d(' + scrollbarTranslations.y.x + 'px,' + scrollbarMovements.y + 'px,0)'
            });

            if ( scrollbars.x.css( 'opacity' ) == 0 && options.directions.x ) {
                scrollbars.x
                    .stop()
                    .css( 'opacity', options.scrollbarOpacity );
            }
            if ( !scrollbars.y.css( 'opacity' ) == 0 && options.directions.y ) {
                scrollbars.y
                    .stop()
                    .css( 'opacity', options.scrollbarOpacity );
            }
        }

        /**
         * Scroll the target element by a certain amount on the X and Y axis
         * inside its container and return X and Y Axis scrolling borders
         *
         * Furthermore the rubber band effect while reaching the border will be
         * controlled here.
         */
        function scrollBy( left, top ) {
            var oldPosition = extractTransformTranslation( target ),
                containerWidth = container.innerWidth(),
                containerHeight = container.innerHeight(),
                contentWidth = target.innerWidth(), 
                contentHeight = target.innerHeight(), 
                oldBorder  = {
                    'x': calculateScrollBorder( containerWidth, contentWidth, oldPosition.x ),
                    'y': calculateScrollBorder( containerHeight, contentHeight, oldPosition.y )
                },
                newBorder = {
                    'x': calculateScrollBorder( containerWidth, contentWidth, oldPosition.x - left ),
                    'y': calculateScrollBorder( containerHeight, contentHeight, oldPosition.y - top )
                },
                newPosition = {};

            // Size down movement relative to the border offset if the border
            // is increasing
            if ( Math.abs( newBorder.y ) > Math.abs( oldBorder.y ) ) {
                top *= 1 / Math.log( Math.abs( newBorder.y ) );
            }
            if ( Math.abs( newBorder.x ) > Math.abs( oldBorder.x ) ) {
                left *= 1 / Math.log( Math.abs( newBorder.x ) );
            }

            newPosition = {
                x: oldPosition.x - left,
                y: oldPosition.y - top
            };

            target.css( 
                '-webkit-transform',
                'translate3d(' + newPosition.x + 'px,' + ( newPosition.y - top ) + 'px,0)'
            );

            drawScrollbars( newPosition, newBorder );
            
            // This border is not 100% accurate, as it would have to be
            // recalculated using the down sized movement values. But it is
            // accurate enough for our purpose, therefore further calculations
            // are not done for performance reasons.
            return newBorder;
        }



        /**
         * Beginning of main plugin code
         */

        options = $.extend({
            deceleration: 0.03,            
            rubberband: 0.15,
            resolution: 13,
            touchsamples: 500,
            accumulationTime: 200,
            directions: {x: true, y: true},
            scrollbars: {x: true, y: true},
            scrollbarSpace: 3,
            scrollbarSize: 5,
            scrollbarColor: '#222222',
            scrollbarOpacity: 0.75,
            scrollbarFadeOutTime: 400,
            scrollbarFadeOutDelay: 100,
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
                }),
                /**
                 * Scrollbars to show position while scrolling
                 */
                scrollbars = {
                    x: $( '<div />', {
                        css: {
                            'position': 'absolute',
                            'top': '0',
                            'left': '0',
                            'height': options.scrollbarSize + 'px',
                            'opacity': 0,
                            'background': options.scrollbarColor,
                            '-webkit-border-radius': options.scrollbarSize,
                            '-webkit-transform': 'translate3d(0,' + ( parseInt( options.height ) - parseInt( options.scrollbarSize ) - parseInt( options.scrollbarSpace ) ) + 'px,0)'
                        }
                    }),
                    y: $( '<div />', {
                        css: {
                            'position': 'absolute',
                            'top': '0',
                            'left': '0',
                            'width': options.scrollbarSize + 'px',
                            'opacity': 0,
                            'background': options.scrollbarColor,
                            '-webkit-border-radius': options.scrollbarSize,
                            '-webkit-transform': 'translate3d(' + ( parseInt( options.width ) - parseInt( options.scrollbarSize ) - parseInt( options.scrollbarSpace ) ) + 'px,0,0)'
                        }
                    })
                };


            target.css({
                'position': 'absolute',
                'top': '0px',
                'left': '0px'
            }).wrap( container );

            // Update the container to the real DOM element instead of the
            // generated one
            container = target.parent();

            // Add the scrollbars
            container
                .append( scrollbars.x )
                .append( scrollbars.y );

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
                            -1 * movement.x, 
                            -1 * movement.y  
                        ), options.rubberband ) );

                        if ( newVelocity.x === 0 && newVelocity.y === 0 
                          && rubberband().x === 0 && rubberband().y === 0 ) {
                            clearInterval( movementTimer );
                            movementTimer = null;
                            
                            // Fadeout the scrollbars
                            scrollbars.x
                                .delay( options.scrollbarFadeOutDelay )
                                .animate(
                                    { opacity: 0 },
                                    options.scrollbarsFadeOutTime
                                );

                            scrollbars.y
                                .delay( options.scrollbarFadeOutDelay )
                                .animate(
                                    { opacity: 0 },
                                    options.scrollbarsFadeOutTime
                                );
                        }
                    }, options.resolution );
                }
            }) );
        });
    }
})( jQuery );
