define("mvc/history/history-list", ["exports", "utils/localization", "utils/ajax-queue", "utils/utils", "mvc/grid/grid-view", "mvc/history/history-model", "mvc/history/copy-dialog", "ui/loading-indicator"], function(exports, _localization, _ajaxQueue, _utils, _gridView, _historyModel, _copyDialog, _loadingIndicator) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _localization2 = _interopRequireDefault(_localization);

    var _ajaxQueue2 = _interopRequireDefault(_ajaxQueue);

    var _utils2 = _interopRequireDefault(_utils);

    var _gridView2 = _interopRequireDefault(_gridView);

    var _historyModel2 = _interopRequireDefault(_historyModel);

    var _copyDialog2 = _interopRequireDefault(_copyDialog);

    var _loadingIndicator2 = _interopRequireDefault(_loadingIndicator);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    /** This class renders the grid list. */
    var HistoryGridView = _gridView2.default.extend({
        initialize: function initialize(grid_config) {
            this.ajaxQueue = new _ajaxQueue2.default.AjaxQueue();
            _gridView2.default.prototype.initialize.call(this, grid_config);
        },

        init_grid_elements: function init_grid_elements() {
            var ajaxQueue = this.ajaxQueue;
            ajaxQueue.stop();
            _gridView2.default.prototype.init_grid_elements.call(this);
            var fetchDetails = $.makeArray(this.$el.find(".delayed-value-datasets_by_state").map(function(i, el) {
                return function() {
                    var historyId = $(el).data("history-id");
                    var url = Galaxy.root + "api/histories/" + historyId + "?keys=nice_size,contents_active,contents_states";
                    var options = {};
                    options.url = url;
                    options.type = "GET";
                    options.success = function(req) {
                        var contentsStates = req["contents_states"];
                        var stateHtml = "";
                        var _arr = ["ok", "running", "queued", "new", "error"];
                        for (var _i = 0; _i < _arr.length; _i++) {
                            var state = _arr[_i];
                            var stateCount = contentsStates[state];
                            if (stateCount) {
                                stateHtml += "<div class=\"count-box state-color-" + state + "\" title=\"Datasets in " + state + " state\">" + stateCount + "</div> ";
                            }
                        }
                        var contentsActive = req["contents_active"];
                        var deleted = contentsActive["deleted"];
                        if (deleted) {
                            stateHtml += "<div class=\"count-box state-color-deleted\" title=\"Deleted datasets\">" + deleted + "</div> ";
                        }
                        var hidden = contentsActive["hidden"];
                        if (hidden) {
                            stateHtml += "<div class=\"count-box state-color-hidden\" title=\"Hidden datasets\">" + hidden + "</div> ";
                        }
                        $(".delayed-value-datasets_by_state[data-history-id='" + historyId + "']").html(stateHtml);
                        $(".delayed-value-disk_size[data-history-id='" + historyId + "']").html(req["nice_size"]);
                    };
                    var xhr = jQuery.ajax(options);
                    return xhr;
                };
            }));
            fetchDetails.forEach(function(fn) {
                return ajaxQueue.add(fn);
            });
            ajaxQueue.start();
        },
        _showCopyDialog: function _showCopyDialog(id) {
            var history = new _historyModel2.default.History({
                id: id
            });
            history.fetch().fail(function() {
                alert("History could not be fetched. Please contact an administrator");
            }).done(function() {
                (0, _copyDialog2.default)(history, {}).done(function() {
                    if (window.parent && window.parent.Galaxy && window.parent.Galaxy.currHistoryPanel) {
                        window.parent.Galaxy.currHistoryPanel.loadCurrentHistory();
                    }
                    window.location.reload(true);
                });
            });
        },
        /** Add an operation to the items menu */
        _add_operation: function _add_operation(popup, operation, item) {
            var self = this;
            var settings = item.operation_config[operation.label];
            if (operation.label == "Copy") {
                operation.onclick = function(id) {
                    self._showCopyDialog(id);
                };
            }
            if (settings.allowed && operation.allow_popup) {
                popup.addItem({
                    html: operation.label,
                    href: settings.url_args,
                    target: settings.target,
                    confirmation_text: operation.confirm,
                    func: function func(e) {
                        e.preventDefault();
                        var label = $(e.target).html();
                        if (operation.onclick) {
                            operation.onclick(item.encode_id);
                        } else {
                            self.execute(this.findItemByHtml(label));
                        }
                    }
                });
            }
        }
    });

    var View = Backbone.View.extend({
        title: (0, _localization2.default)("Histories"),
        initialize: function initialize(options) {
            var self = this;
            _loadingIndicator2.default.markViewAsLoading(this);

            this.model = new Backbone.Model();
            _utils2.default.get({
                url: Galaxy.root + "history/" + options.action_id + "?" + $.param(Galaxy.params),
                success: function success(response) {
                    self.model.set(response);
                    self.render();
                }
            });
        },

        render: function render() {
            var grid = new HistoryGridView(this.model.attributes);
            this.$el.empty().append(grid.$el);
        }
    });

    exports.default = {
        View: View
    };
});
//# sourceMappingURL=../../../maps/mvc/history/history-list.js.map
