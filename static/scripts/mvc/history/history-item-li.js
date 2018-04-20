define("mvc/history/history-item-li", ["exports"], function(exports) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    function _templateNametag(tag) {
        return "<span class=\"label label-info\">" + _.escape(tag.slice(5)) + "</span>";
    }

    function nametagTemplate(historyItem) {
        var uniqueNametags = _.filter(_.uniq(historyItem.tags), function(t) {
            return t.indexOf("name:") === 0;
        });
        var nametagsDisplay = _.sortBy(uniqueNametags).map(_templateNametag);
        return "\n        <div class=\"nametags\" title=\"" + uniqueNametags.length + " nametags\">\n            " + nametagsDisplay.join("") + "\n        </div>";
    }

    exports.default = {
        nametagTemplate: nametagTemplate
    };
});
//# sourceMappingURL=../../../maps/mvc/history/history-item-li.js.map
