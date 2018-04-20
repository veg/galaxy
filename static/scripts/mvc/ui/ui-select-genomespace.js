define("mvc/ui/ui-select-genomespace", ["exports", "utils/localization", "utils/utils", "mvc/ui/ui-misc", "mvc/tool/tool-genomespace"], function(exports, _localization, _utils, _uiMisc, _toolGenomespace) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _localization2 = _interopRequireDefault(_localization);

    var _utils2 = _interopRequireDefault(_utils);

    var _uiMisc2 = _interopRequireDefault(_uiMisc);

    var _toolGenomespace2 = _interopRequireDefault(_toolGenomespace);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    /**
     * GenomeSpace file selector
     */
    var View = Backbone.View.extend({
        // initialize
        initialize: function initialize(options) {
            // link this
            var self = this;
            this.options = options;

            // create insert new list element button
            this.browse_button = new _uiMisc2.default.ButtonIcon({
                title: (0, _localization2.default)("Browse"),
                icon: "fa fa-sign-in",
                tooltip: (0, _localization2.default)("Browse GenomeSpace"),
                onclick: function onclick() {
                    self.browseGenomeSpace(options);
                }
            });

            // create genomespace filepath textbox
            this.filename_textbox = new _uiMisc2.default.Input();

            // create elements
            this.setElement(this._template(options));
            this.$(".ui-gs-browse-button").append(this.browse_button.$el);
            this.$(".ui-gs-filename-textbox").append(this.filename_textbox.$el);
        },

        /** Browse GenomeSpace */
        browseGenomeSpace: function browseGenomeSpace(options) {
            var self = this;
            _toolGenomespace2.default.openFileBrowser({
                successCallback: function successCallback(data) {
                    self.value(data.destination);
                }
            });
        },

        /** Main Template */
        _template: function _template(options) {
            return '<div class="ui-gs-select-file">' + '<div class="ui-gs-browse-field">' + '<span class="ui-gs-browse-button" />' + '<span class="ui-gs-filename-textbox" />' + "</div>" + "</div>";
        },

        /** Return/Set currently selected genomespace filename */
        value: function value(new_value) {
            // check if new_value is defined
            if (new_value !== undefined) {
                this._setValue(new_value);
            } else {
                return this._getValue();
            }
        },

        // get value
        _getValue: function _getValue() {
            return this.filename_textbox.value();
        },

        // set value
        _setValue: function _setValue(new_value) {
            if (new_value) {
                this.filename_textbox.value(new_value);
            }
            this.options.onchange && this.options.onchange(new_value);
        }
    });
    // dependencies
    exports.default = {
        View: View
    };
});
//# sourceMappingURL=../../../maps/mvc/ui/ui-select-genomespace.js.map
