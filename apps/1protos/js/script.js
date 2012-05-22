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
        $('#favApps').scrollview({ direction: 'y' });
        $('.card').css({ width: deviceW - 15 });

        //check if is first card -> show soft buttons
        if ($('#world').scrollview('getScrollPosition').x > 0) {
            $('#OWD > footer').show();
        }
    } 

    function hideCards() {
        $('#world').addClass('zoomIn').removeClass('zoomOut').scrollview({ direction: 'y' });
        $('#desktop').css('height', deviceHSK).scrollview({ direction: 'x' });
        $('#favApps').scrollview({ direction: 'x' });
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
        $('#desktop .ui-scrollview-view').css('width', deviceW * 4); //4 pages
        
            $('#world article.page').css({
                'height': deviceH,
                'width': deviceW
            });
            $('#world #desktop article.page').css({
                'height': deviceHSK,
                'width': deviceW
            });
               
                // $('#favApps').scrollview({ pagingEnabled: true });
                // Initial position
                favInit = $('#favApps .ui-scrollview-view').width() / 2;
                $('#favApps').scrollview('scrollTo',-favInit,0);

                var baseFontSizePx = $('html').css('font-size');
                var baseFontSize = parseInt(baseFontSizePx.substr(0,2));
                console.log(baseFontSize);

                $('#favApps').bind('vmouseup', function() {
                    setTimeout(function(){
                        var scrollX = $('#favApps').scrollview('getScrollPosition').x;
                        var iconSize = 6.5 * baseFontSize
                        var initGap = scrollX + (10 * baseFontSize); //position * marginLeft - halfIconSize * baseFontSize
                        var selectedIcon = Math.floor(initGap / iconSize) - 1; 
                        var moveTo = selectedIcon * iconSize;
                        $('#favApps').scrollview('scrollTo',moveTo,0,200);
                        //scale selected
                        $('#favApps li').removeClass('selected');
                        $('#favApps li:eq(' + selectedIcon +')').addClass('selected');
                        $('#favAppsPreview').addClass('show').removeClass('hide');
                    },500);
                        $('#favAppsPreview').addClass('hide').removeClass('show').removeClass('expand');
                });

                $('#favAppsPreview header').bind('vclick', function() {
                    console.log('click')
                    $('#favAppsPreview').hasClass('expand') == true ? 
                        $('#favAppsPreview').addClass('hide').removeClass('show').removeClass('expand') :
                        $('#favAppsPreview').addClass('expand')
                });


        // Carousel: Edit mode    
        $('#favApps').bind('taphold', function() {
            alert('taphold')
        });        
                 
        
        // Notifications    
        $('#notifications').css({
           'height': deviceHSB,
           'top': -deviceHSB
        });
        
        $('#statusBar .slider').bind('swipedown', function(e) {
            $('#notifications').animate({'top': 0},'fast');
            $(this).hide();
        }); 
        $('#statusBar .slider').bind('vclick', function(e) {
            $('#notifications').animate({'top': 0},'fast');
            $(this).hide();
        });
        $('#notifications .slider').bind('swipeup', function(e) {
            $('#notifications').animate({'top': -deviceHSB},'fast');
            $('#statusBar .slider').show();
        });
        $('#notifications .wifi').bind('vclick', function(e) {
            $('#notifications .toggle').animate({'top': 0},'slow').html('');
        });
        
                                                                   
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
    
    //Remove favApps in log Screen
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
