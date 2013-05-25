function Controller() {
    require("alloy/controllers/BaseController").apply(this, Array.prototype.slice.call(arguments));
    arguments[0] ? arguments[0]["__parentSymbol"] : null;
    arguments[0] ? arguments[0]["$model"] : null;
    var $ = this;
    var exports = {};
    var __alloyId1 = [];
    $.__views.__alloyId2 = Alloy.createController("annotation", {
        title: "Appcelerator",
        id: "__alloyId2"
    });
    __alloyId1.push($.__views.__alloyId2.getViewEx({
        recurse: true
    }));
    $.__views.map = Ti.Map.createView({
        top: "50dp",
        animate: true,
        regionFit: true,
        userLocation: false,
        region: {
            latitude: Alloy.Globals.LATITUDE_BASE,
            longitude: Alloy.Globals.LONGITUDE_BASE,
            latitudeDelta: .1,
            longitudeDelta: .1
        },
        annotations: __alloyId1,
        ns: Ti.Map,
        id: "map",
        mapType: Ti.Map.STANDARD_TYPE
    });
    $.__views.map && $.addTopLevelView($.__views.map);
    exports.destroy = function() {};
    _.extend($, $.__views);
    $.map.addEventListener("click", function(e) {
        !e.annotation || "leftButton" !== e.clicksource && "leftPane" != e.clicksource || $.map.removeAnnotation(e.annotation);
    });
    exports.addAnnotation = function(geodata) {
        var annotation = Alloy.createController("annotation", {
            title: geodata.title,
            latitude: geodata.coords.latitude,
            longitude: geodata.coords.longitude
        });
        $.map.addAnnotation(annotation.getView());
        $.map.setLocation({
            latitude: geodata.coords.latitude,
            longitude: geodata.coords.longitude,
            latitudeDelta: 1,
            longitudeDelta: 1
        });
    };
    _.extend($, exports);
}

var Alloy = require("alloy"), Backbone = Alloy.Backbone, _ = Alloy._;

module.exports = Controller;