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
            initialAccelerationTime: 4.0,
            deceleration: 0.020,
            resolution: 13,
            width: "200px",
            height: "200px"
        }, options );

        var accelerationY = __store( $(this), "accelerationY" ),
            velocityY = __store( $(this), "velocityY" ),
            sqrtResolution = Math.sqrt( options.resolution ),
            initialY = 0,
            initalTime = 0,
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
            initialY = e.originalEvent.touches[0].pageY;
            initialTime = e.timeStamp;
            console.log( "touchstart" );
        });

        container.bind( "touchend.kinetic", function( e ) {
            var dTime = e.timeStamp - initialTime,
                dPosition = e.originalEvent.changedTouches[0].pageY - initialY,
                initialAcceleration = ( dPosition * options.initialAccelerationTime ) / dTime;
                
            accelerationY( add( initialAcceleration ) );

            console.log( "touchend" );

            //console.log( "initialAcceleration: %d\ndTime: %d\ndPosition: %d\naccelerationY: %d", initialAcceleration, dTime, dPosition, accelerationY() );
            console.log( "dPosition: " + dPosition );
            console.log( e.originalEvent.changedTouches[0].pageY );

            if ( movementTimer == null ) {
                movementTimer = setInterval( function() {
                    var newVelocityY = velocityY( add( accelerationY() ) ),
                        newAccelerationY = accelerationY( set( 0 ) );

                    //console.log( "newVelocityY: %d\nnewAccelerationY: %d", newVelocityY, newAccelerationY );
                     
                    target.css( 'top', Math.floor( parseInt( target.css( 'top' ) ) + ( newVelocityY )  ) + 'px' );
                    //console.log( Math.floor( parseInt(target.css( 'top' )) + ( newVelocityY ) ) + 'px' );

                    velocityY( converge( options.deceleration ) );

                    if ( newVelocityY === 0 ) {
                        clearInterval( movementTimer );
                        movementTimer = null;
                        //console.log( "interval cleared" );
                    }
                }, options.resolution );
            }
        });
    }
})( jQuery );
