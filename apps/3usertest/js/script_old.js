$().ready(function(){  
    //detect mobile
    if (jQuery.browser.mobile == false) {
        $('#OWD').wrap('<div id="phoneMask" />');
        $('#phoneMask').append('<div id="phoneMaskLeft" /><div id="phoneMaskMiddle" /><div id="phoneMaskRight" />') 
        $('body').addClass('desktop');
    } else {
        $('#OWD').wrap('<div id="mobile" />');
        $('#functionality').remove();
    }
    
    //display date and time
    var myDate = new Date();
    var dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ]
    var MonthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'september', 'October', 'November', 'December'];
    var today = dayName[myDate.getDay()] + ' ' + myDate.getDate() + ' ' + MonthName[myDate.getMonth()];
    var now = pad2(myDate.getHours()) + ':' + pad2(myDate.getMinutes());
    $('.currentDate').text(today);
    $('.currentTime').text(now);
    
    var deviceHSB = $('#OWD').height(); //height including StatusBar
    var deviceH = deviceHSB - $('#OWD > header').height();
    var deviceHSK = deviceH - $('#OWD > footer').height(); //height - softkeys 
    var deviceW = $('#OWD').width();
    
    function showCards() {
        $('#world').addClass('zoomOut').removeClass('zoomIn').scrollview({ direction: 'x' });
        $('#desktop').css('height', deviceH).scrollview({ direction: 'y' });
        $('#carousel').scrollview({ direction: 'y' });
        $('.card').css({ width: deviceW - 15 });

        //check if is first card -> show soft buttons
        if ($('#world').scrollview('getScrollPosition').x > 0) {
            $('#OWD > footer').show();
        }
    } 

    function hideCards() {
        $('#world').addClass('zoomIn').removeClass('zoomOut').scrollview({ direction: 'y' });
        $('#desktop').css('height', deviceHSK).scrollview({ direction: 'x' });
        $('#carousel').scrollview({ direction: 'x' });
        $('.card').css({ width: deviceW });

        //check if is not first card -> hide soft buttons
        if ($('#world').scrollview('getScrollPosition').x > 0) {
            $('#OWD > footer').hide();
        }
    }
    //softkey log -> Card navigation
    /*$('#SKlog').bind('vclick', function(e) {
        if ($('#world').hasClass('zoomOut') == false) { 
            showCards();
            $('#world').scrollview('scrollTo',deviceW,0,100);
            hideCards();
        }
    });*/
    
    //hardkey middle -> Card navigation
    $('#phoneMaskMiddle').bind('vclick', function(e) {
        $('#world').hasClass('zoomOut') == false ? showCards() : hideCards();
    });
    
    $('#SKclock').bind('vclick', function(e) {
        $('#world').hasClass('zoomOut') == false ? showCards() : hideCards();
    });
        
    //hardkey right -> Reload
    $('#phoneMaskRight').click(function() {
        location.reload()
    });
/*–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––*/
    
    //init scrollView
    $('#world').scrollview({ pagingEnabled: true, direction: 'y' }); //direction: 'y' to disable it
    $('#world').css({
        'height': deviceHSK,
        'top': $('#OWD > header').height()
    });
    $('#world .ui-scrollview-view').css('width', deviceW * 2); 
    
        $('#world section.card').css({
            'height': deviceH,
            'width': deviceW
        }); 
        
        $('#desktop').scrollview({ pagingEnabled: true });
        $('section.card#desktop').css('height', deviceHSK);
        $('#desktop .ui-scrollview-view').css('width', deviceW * 3); //4 pages
        
            $('#world article.page').css({
                'height': deviceH,
                'width': deviceW
            });
            $('#world #desktop article.page').css({
                'height': deviceHSK,
                'width': deviceW
            });
               
                // $('#carousel').scrollview({ pagingEnabled: true });
                // Initial position
                var baseFontSizePx = $('html').css('font-size');
                var baseFontSize = parseInt(baseFontSizePx.substr(0,2));
                var iconSize = 9 * baseFontSize;
                var carouselLeft = (deviceW - iconSize) / 2;
                var carouselSize = (iconSize * 9) + carouselLeft; // * number of icons + marginLeft
                $('ul#carousel .ui-scrollview-view').css('width', carouselSize);
                $('ul#carousel').css('margin-left', carouselLeft);
                carouselInit = 9 * baseFontSize * 5; //iconsize * 5th icon
                $('#carousel').scrollview('scrollTo',-carouselInit,0);

                //launch tooltip for 5th icon
                $('.tooltip').text($('#carousel li:eq(5) img').attr('title'));
                $('.tooltip').addClass('show').removeClass('hide');

                $('#carousel').bind('vmouseup', function() {
                    setTimeout(function(){
                        var scrollX = $('#carousel').scrollview('getScrollPosition').x;
                        var iconSize = 9 * baseFontSize;
                        var initGap = scrollX - (iconSize / 2);
                        var selectedIcon = Math.floor(initGap / iconSize) + 1; 
                        var moveTo = selectedIcon * iconSize;
                        console.log(scrollX);
                        console.log(selectedIcon);
                        $('#carousel').scrollview('scrollTo',moveTo,0,200);

                        if (selectedIcon == 1) {
                            //scale selected
                            $('#carousel li').removeClass('selected');
                            $('#carousel li:eq(' + selectedIcon +')').addClass('selected');
                            $('#carouselPreview').addClass('show').removeClass('hide');
                        } else {
                            //$('#carousel li:eq(' + selectedIcon + ')').hide();
                            var tooltipTitle = $('#carousel li:eq(' + selectedIcon + ') img').attr('title');
                            if (tooltipTitle != undefined) {
                               $('.tooltip').text(tooltipTitle);
                               $('.tooltip').addClass('show').removeClass('hide');
                            }
                        } 
                    },500);
                        $('#carouselPreview').addClass('hide').removeClass('show').removeClass('expand');
                        $('.tooltip').addClass('hide').removeClass('show');

                });
                
                /*$(document).bind('taphold', function() {
                    alert('hola');
                });*/

                $('#carouselPreview footer').bind('vclick', function() {
                    $('#carouselPreview').hasClass('expand') == true ? 
                        $('#carouselPreview').addClass('collapse').removeClass('expand') :
                        $('#carouselPreview').addClass('expand').removeClass('collapse')
                });
                $('#carouselPreview section').bind('swipedown', function() {
                    $('#carouselPreview').addClass('collapse').removeClass('expand')
                });


        // Carousel: Edit mode    
        $('#carousel').bind('taphold', function() {
            alert('taphold')
        });        
                 
        
        // Notifications    
        // $('#notifications').css({
        //    'height': deviceHSB,
        //    'top': -deviceHSB
        // });
        
        // $('#statusBar .slider').bind('swipedown', function(e) {
        //     $('#notifications').animate({'top': 0},'fast');
        //     $(this).hide();
        // }); 
        // $('#statusBar .slider').bind('vclick', function(e) {
        //     $('#notifications').animate({'top': 0},'fast');
        //     $(this).hide();
        // });
        // $('#notifications .slider').bind('swipeup', function(e) {
        //     $('#notifications').animate({'top': -deviceHSB},'fast');
        //     $('#statusBar .slider').show();
        // });
        // $('#notifications .wifi').bind('vclick', function(e) {
        //     $('#notifications .toggle').animate({'top': 0},'slow').html('');
        // });
        
                                                                   
        /*$('#notifications').scrollview({ pagingEnabled: true });
        $('#notifications').scrollview('scrollTo',0,-deviceH); 
        $('#notifications').css({
            'height': deviceH //+ $('#notifications .slider').height()//,
            //'top': -deviceH/2
            ,'bottom': '-18px'
        });
        $('#notifications .ui-scrollview-view').css({
            'height': deviceH * 2//,
           // 'top': deviceH/2
        }); 
        $('#notifications .page').css({
            'height': deviceH 
            //,'margin-top': '18px'
        });*/
        
    //Add pagination
    var page = 0; 
    var pageCount = $('#desktop .page').length;
    $('#desktop .page').each(function() {
        $(this).prepend('<header><ul class="pagination">');
        for (var i=0; i < pageCount; i++) { 
            if (i == page) {
                $(this).find('.pagination').append('<li class="active">'+ i +'</li>');
            } else {
                $(this).find('.pagination').append('<li>'+ i +'</li>');
            }
        };
        page ++;
    })
    $('#desktop .pagination li').css('width', 100 / pageCount + '%');
    
    //Remove carousel in log Screen
    /*$('#HscrollView').bind('vmousemove', function(e) {
        var scrollX = $('#HscrollView').scrollview('getScrollPosition').x;
        //console.log(scrollX);
        if (scrollX < deviceW) {
            $('footer').css({'height':50});
            $('footer ul').css({'opacity': 0});
        } else {
            $('footer').css({'height': '35%'});
            $('footer ul').css({'opacity': 1});
        } 
    });*/

    
});

//FUNCTIONS:
function pad2(number) {
    return (number < 10 ? '0' : '') + number
}
