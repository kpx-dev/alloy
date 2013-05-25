var RSS_URL = "https://graph.facebook.com/307023978966?fields=albums.fields(name)";

var MONTH_MAP = {
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12
};

var getRssText = function(item, key) {
    return item.getElementsByTagName(key).item(0).text;
};

var parseDate = function(dateString) {
    var dateParts = dateString.split(" ");
    var timeParts = dateParts[4].split(":");
    return MONTH_MAP[dateParts[2].toUpperCase()] + "/" + dateParts[1] + " " + timeParts[0] + ":" + timeParts[1];
};

exports.loadRssFeed = function(o) {
    var url = "https://graph.facebook.com/307023978966?fields=albums.fields(name)";
    var xhr = Ti.Network.createHTTPClient({
        onload: function() {
            var json = JSON.parse(this.responseText);
            Ti.API.error(json.albums.data);
            var data = [];
            for (i = 0; json.albums.data.length > i; i++) data.push({
                title: json.albums.data[i].name
            });
            Ti.API.error(data);
            for (album in json.albums.data) Ti.API.error(album);
            o.success(data);
            alert("success");
        },
        onerror: function(e) {
            Ti.API.debug(e.error);
            alert("error");
        },
        timeout: 5e3
    });
    xhr.open("GET", url);
    xhr.send();
};