// var RSS_URL = OS_MOBILEWEB ? '/feed.xml' : 'http://feeds.mashable.com/Mashable?format=xml';
var RSS_URL = 'https://graph.facebook.com/307023978966?fields=albums.fields(name)';

var MONTH_MAP = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

var getRssText = function(item, key) {
	return OS_MOBILEWEB ?
			item.getElementsByTagName(key).item(0).textContent : //childNodes[0].nodeValue :
			item.getElementsByTagName(key).item(0).text;
}

var parseDate = function(dateString) {
	var dateParts = dateString.split(' ');
	var timeParts = dateParts[4].split(':');
	return MONTH_MAP[dateParts[2].toUpperCase()] + '/' + dateParts[1] + ' ' + timeParts[0] + ':' + timeParts[1];
}

exports.loadRssFeed = function(o, tries) {
	var url = "https://graph.facebook.com/307023978966?fields=albums.fields(name)";
	var xhr = Ti.Network.createHTTPClient({
	    onload: function(e) {
	        // this.responseText holds the raw text return of the message (used for JSON)
	        // this.responseXML holds any returned XML (used for SOAP web services)
	        // this.responseData holds any returned binary data
			var json = JSON.parse(this.responseText);
	        Ti.API.error(json.albums.data);

			var data = [];

			for (i = 0; i < json.albums.data.length; i++)
			{
				data.push({
					title: json.albums.data[i].name,
					// link: getRssText(item, 'link'),
					// pubDate: parseDate(getRssText(item, 'pubDate')),
					// image: image
				});
			}
	        Ti.API.error(data);

			for(album in json.albums.data)
			{
		        Ti.API.error(album);
			}

			o.success(data)
	        alert('success');
	    },
	    onerror: function(e) {
	        Ti.API.debug(e.error);
	        alert('error');
	    },
	    timeout:5000
	});
 
	xhr.open("GET", url);
	xhr.send();


				// var item = items.item(i);
			// var image;
			// try {
				// image = item.getElementsByTagNameNS('http://mashable.com/', 'thumbnail').item(0).getElementsByTagName('img').item(0).getAttribute('src');
			// } catch (e) {
				// image = '';
			// }
//
			// data.push({
				// title: getRssText(item, 'title'),
				// link: getRssText(item, 'link'),
				// pubDate: parseDate(getRssText(item, 'pubDate')),
				// image: image
			// });
		// }
		// if (o.success) { o.success(data); }
	// };
	// xhr.onerror = function(e) {
		// if (o.error) { o.error(); }
	// };
//
	// if (o.start) { o.start(); }
	// xhr.send();
};