define("mvc/webhooks", ["exports", "utils/utils"], function(exports, _utils) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _utils2 = _interopRequireDefault(_utils);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _slicedToArray = function() {
        function sliceIterator(arr, i) {
            var _arr = [];
            var _n = true;
            var _d = false;
            var _e = undefined;

            try {
                for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                    _arr.push(_s.value);

                    if (i && _arr.length === i) break;
                }
            } catch (err) {
                _d = true;
                _e = err;
            } finally {
                try {
                    if (!_n && _i["return"]) _i["return"]();
                } finally {
                    if (_d) throw _e;
                }
            }

            return _arr;
        }

        return function(arr, i) {
            if (Array.isArray(arr)) {
                return arr;
            } else if (Symbol.iterator in Object(arr)) {
                return sliceIterator(arr, i);
            } else {
                throw new TypeError("Invalid attempt to destructure non-iterable instance");
            }
        };
    }();

    var Webhooks = Backbone.Collection.extend({
        url: function url() {
            return Galaxy.root + "api/webhooks";
        }
    });

    var WebhookView = Backbone.View.extend({
        el: "#webhook-view",

        initialize: function initialize(options) {
            var _this = this;

            var toolId = options.toolId || "";
            var toolVersion = options.toolVersion || "";

            this.$el.attr("tool_id", toolId);
            this.$el.attr("tool_version", toolVersion);

            var webhooks = new Webhooks();
            webhooks.fetch({
                success: function success(data) {
                    if (options.type) {
                        data.reset(filterType(data, options.type));
                    }
                    if (data.length > 0) {
                        _this.render(weightedRandomPick(data));
                    }
                }
            });
        },

        render: function render(model) {
            var webhook = model.toJSON();
            this.$el.html("<div id=\"" + webhook.id + "\"></div>");
            _utils2.default.appendScriptStyle(webhook);
            return this;
        }
    });

    var load = function load(options) {
        var webhooks = new Webhooks();
        webhooks.fetch({
            async: options.async !== undefined ? options.async : true,
            success: function success(data) {
                if (options.type) {
                    data.reset(filterType(data, options.type));
                }
                options.callback(data);
            }
        });
    };

    function filterType(data, type) {
        return data.models.filter(function(item) {
            var itype = item.get("type");
            if (itype) {
                return itype.indexOf(type) !== -1;
            } else {
                return false;
            }
        });
    }

    function weightedRandomPick(data) {
        var weights = data.pluck("weight");
        var sum = weights.reduce(function(a, b) {
            return a + b;
        });

        var normalizedWeightsMap = new Map();
        weights.forEach(function(weight, index) {
            normalizedWeightsMap.set(index, parseFloat((weight / sum).toFixed(2)));
        });

        var table = [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = normalizedWeightsMap[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var _ref = _step.value;

                var _ref2 = _slicedToArray(_ref, 2);

                var index = _ref2[0];
                var weight = _ref2[1];

                for (var i = 0; i < weight * 100; i++) {
                    table.push(index);
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }

        return data.at(table[Math.floor(Math.random() * table.length)]);
    }

    exports.default = {
        WebhookView: WebhookView,
        load: load
    };
});
//# sourceMappingURL=../../maps/mvc/webhooks.js.map
