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
         * Initialize a new store bound to a certain jQuery-DOM object and a
         * certain identifier.
         *
         * Different kinds of operations can be applied to a datastore.
         */
        __store = function( element, id ) {
            /**
             * Function to apply a certain operation onto the acceleration
             * value stored insinde the DOM object.
             */
            return function( op ) {
                var data = element.data( "__kinetic__" ) || {};

                // Do nothing, if no operation is provided
                if ( op === undefined ) {
                    op = noop;
                }
                    
                data[id] = op( data[id] || 0 );
                
                element.data( "__kinetic__", data );

                return data[id];
            }
        };

    $.fn.kinetic = function( options ) {
        options = $.extend({
            deceleration: 0.03,            
            resolution: 13,
            touchsamples: 500,
            accumulationTime: 200,
            width: "400px",
            height: "400px"
        }, options );

        var velocityX = __store( $(this), "velocityX" ),
            velocityY = __store( $(this), "velocityY" ),
            lastTouches = null;
            movementTimer = null,
            target = $(this),
            container = $( '<div />', {
                css: {
                    'position': 'relative',
                    'overflow': 'hidden',
                    'width': options.width,
                    'height': options.height,
                    'border': "1px solid orange"
                }
            });

        target.css({
            'position': 'absolute',
            'top': '0px',
            'left': '0px'
        }).wrap( container );

        // Update the container to the real DOM element
        container = target.parent();

        container.bind( "touchstart.kinetic", function( e ) {
            var eo = e.originalEvent;


            // Only handle first finger touchstart
            if ( eo.touches.length !== 1 ) {
                return;
            }

            // Stop all running movements
            if ( movementTimer !== null ) {
                clearInterval( movementTimer );
                movementTimer = null;
            }

            lastTouches = [{
                'time': e.timeStamp,
                'x': eo.touches[0].pageX,
                'y': eo.touches[0].pageY
            }];
        });

        container.bind( "touchmove.kinetic", function( e ) {
            var eo = e.originalEvent,
                lastTouch = lastTouches[lastTouches.length - 1],
                currentTouch = null;

            // Check if the first finger moved
            if ( lastTouch.x == eo.touches[0].pageX && lastTouch.y == eo.touches[0].pageY ) {
                // No movement of the first finger
                // @TODO: Something ist not 100% correct here concerning
                // multiple finger movement
                return;
            }

            lastTouches.push( 
                currentTouch = {
                    'time': e.timeStamp,
                    'x': eo.touches[0].pageX,
                    'y': eo.touches[0].pageY
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
        });

        container.bind( "touchend.kinetic", function( e ) {                      
            var eo = e.originalEvent,
                startTouch = null,
                endTouch = null;

            /*
            if ( eo.changedTouches.length != 1 ) {
                return;
            }
*/
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

            velocityX( 
                set( ( endTouch.x - startTouch.x ) / ( endTouch.time - startTouch.time ) ) 
            );

            velocityY( 
                set( ( endTouch.y - startTouch.y ) / ( endTouch.time - startTouch.time ) ) 
            );
            
            if ( movementTimer == null ) {
                movementTimer = setInterval( function() {
                    target.css({
                        'top':
                             Math.floor( parseInt( target.css( 'top' ) ) + velocityY() * options.resolution ) + 'px',
                        'left':
                             Math.floor( parseInt( target.css( 'left' ) ) + velocityX() * options.resolution )  + 'px'
                    });

                    var newVelocityX = velocityX( converge( options.deceleration ) ),
                        newVelocityY = velocityY( converge( options.deceleration ) );

                    if ( newVelocityX === 0 && newVelocityY === 0 ) {
                        clearInterval( movementTimer );
                        movementTimer = null;
                    }
                }, options.resolution );
            }
        });
    }
})( jQuery );
