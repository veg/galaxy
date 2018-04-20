define("viz/trackster", ["exports", "utils/localization", "libs/underscore", "libs/backbone", "viz/trackster/tracks", "viz/visualization", "mvc/ui/icon-button", "utils/query-string-parsing", "mvc/grid/grid-view", "utils/utils", "libs/jquery/jquery.event.drag", "libs/jquery/jquery.event.hover", "libs/jquery/jquery.mousewheel", "libs/jquery/jquery-ui", "libs/jquery/select2", "libs/farbtastic", "libs/jquery/jquery.form", "libs/jquery/jquery.rating", "ui/editable-text"], function(exports, _localization, _underscore, _backbone, _tracks, _visualization, _iconButton, _queryStringParsing, _gridView, _utils) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _localization2 = _interopRequireDefault(_localization);

    var _ = _interopRequireWildcard(_underscore);

    var Backbone = _interopRequireWildcard(_backbone);

    var _tracks2 = _interopRequireDefault(_tracks);

    var _visualization2 = _interopRequireDefault(_visualization);

    var _iconButton2 = _interopRequireDefault(_iconButton);

    var _queryStringParsing2 = _interopRequireDefault(_queryStringParsing);

    var _gridView2 = _interopRequireDefault(_gridView);

    var _utils2 = _interopRequireDefault(_utils);

    function _interopRequireWildcard(obj) {
        if (obj && obj.__esModule) {
            return obj;
        } else {
            var newObj = {};

            if (obj != null) {
                for (var key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                }
            }

            newObj.default = obj;
            return newObj;
        }
    }

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function() {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function(Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    var TracksterUI = function(_Backbone$Model) {
        _inherits(TracksterUI, _Backbone$Model);

        function TracksterUI(options) {
            _classCallCheck(this, TracksterUI);

            return _possibleConstructorReturn(this, (TracksterUI.__proto__ || Object.getPrototypeOf(TracksterUI)).call(this, options));
        }

        _createClass(TracksterUI, [{
            key: "initialize",
            value: function initialize(baseURL) {
                this.baseURL = baseURL;
                _utils2.default.cssLoadFile("static/style/jquery.rating.css");
                _utils2.default.cssLoadFile("static/style/autocomplete_tagging.css");
                _utils2.default.cssLoadFile("static/style/jquery-ui/smoothness/jquery-ui.css");
                _utils2.default.cssLoadFile("static/style/library.css");
                _utils2.default.cssLoadFile("static/style/trackster.css");
            }
        }, {
            key: "save_viz",
            value: function save_viz() {
                var _this2 = this;

                // show dialog
                Galaxy.modal.show({
                    title: "Saving...",
                    body: "progress"
                });

                // Save bookmarks.
                var bookmarks = [];
                $(".bookmark").each(function() {
                    bookmarks.push({
                        position: $(_this2).children(".position").text(),
                        annotation: $(_this2).children(".annotation").text()
                    });
                });

                // FIXME: give unique IDs to Drawables and save overview as ID.
                var overview_track_name = this.view.overview_drawable ? this.view.overview_drawable.config.get_value("name") : null;

                var viz_config = {
                    view: this.view.to_dict(),
                    viewport: {
                        chrom: this.view.chrom,
                        start: this.view.low,
                        end: this.view.high,
                        overview: overview_track_name
                    },
                    bookmarks: bookmarks
                };

                // Make call to save visualization.
                return $.ajax({
                    url: Galaxy.root + "visualization/save",
                    type: "POST",
                    dataType: "json",
                    data: {
                        id: this.view.vis_id,
                        title: this.view.config.get_value("name"),
                        dbkey: this.view.dbkey,
                        type: "trackster",
                        vis_json: JSON.stringify(viz_config)
                    }
                }).success(function(vis_info) {
                    Galaxy.modal.hide();
                    _this2.view.vis_id = vis_info.vis_id;
                    _this2.view.has_changes = false;

                    // Needed to set URL when first saving a visualization.
                    window.history.pushState({}, "", vis_info.url + window.location.hash);
                }).error(function() {
                    // show dialog
                    Galaxy.modal.show({
                        title: (0, _localization2.default)("Could Not Save"),
                        body: "Could not save visualization. Please try again later.",
                        buttons: {
                            Cancel: function Cancel() {
                                Galaxy.modal.hide();
                            }
                        }
                    });
                });
            }
        }, {
            key: "createButtonMenu",
            value: function createButtonMenu() {
                var _this3 = this;

                var menu = _iconButton2.default.create_icon_buttons_menu([{
                    icon_class: "plus-button",
                    title: (0, _localization2.default)("Add tracks"),
                    on_click: function on_click() {
                        _visualization2.default.select_datasets({
                            dbkey: _this3.view.dbkey
                        }, function(new_tracks) {
                            _.each(new_tracks, function(track) {
                                _this3.view.add_drawable(_tracks2.default.object_from_template(track, _this3.view, _this3.view));
                            });
                        });
                    }
                }, {
                    icon_class: "block--plus",
                    title: (0, _localization2.default)("Add group"),
                    on_click: function on_click() {
                        _this3.view.add_drawable(new _tracks2.default.DrawableGroup(_this3.view, _this3.view, {
                            name: "New Group"
                        }));
                    }
                }, {
                    icon_class: "bookmarks",
                    title: (0, _localization2.default)("Bookmarks"),
                    on_click: function on_click() {
                        // HACK -- use style to determine if panel is hidden and hide/show accordingly.
                        window.force_right_panel($("div#right").css("right") == "0px" ? "hide" : "show");
                    }
                }, {
                    icon_class: "globe",
                    title: (0, _localization2.default)("Circster"),
                    on_click: function on_click() {
                        window.location = _this3.baseURL + "visualization/circster?id=" + _this3.view.vis_id;
                    }
                }, {
                    icon_class: "disk--arrow",
                    title: (0, _localization2.default)("Save"),
                    on_click: function on_click() {
                        _this3.save_viz();
                    }
                }, {
                    icon_class: "cross-circle",
                    title: (0, _localization2.default)("Close"),
                    on_click: function on_click() {
                        _this3.handle_unsaved_changes(_this3.view);
                    }
                }], {
                    tooltip_config: {
                        placement: "bottom"
                    }
                });

                this.buttonMenu = menu;
                return menu;
            }
        }, {
            key: "add_bookmark",
            value: function add_bookmark(position, annotation, editable) {
                var _this4 = this;

                // Create HTML.
                var bookmarks_container = $("#right .unified-panel-body");

                var new_bookmark = $("<div/>").addClass("bookmark").appendTo(bookmarks_container);

                var position_div = $("<div/>").addClass("position").appendTo(new_bookmark);

                //position_link
                $("<a href=''/>").text(position).appendTo(position_div).click(function() {
                    _this4.view.go_to(position);
                    return false;
                });

                var annotation_div = $("<div/>").text(annotation).appendTo(new_bookmark);

                // If editable, enable bookmark deletion and annotation editing.
                if (editable) {
                    var delete_icon_container = $("<div/>").addClass("delete-icon-container").prependTo(new_bookmark).click(function() {
                        // Remove bookmark.
                        new_bookmark.slideUp("fast");
                        new_bookmark.remove();
                        _this4.view.has_changes = true;
                        return false;
                    });

                    // delete_icon
                    $("<a href=''/>").addClass("icon-button delete").appendTo(delete_icon_container);

                    annotation_div.make_text_editable({
                        num_rows: 3,
                        use_textarea: true,
                        help_text: "Edit bookmark note"
                    }).addClass("annotation");
                }

                this.view.has_changes = true;
                return new_bookmark;
            }
        }, {
            key: "create_visualization",
            value: function create_visualization(view_config, viewport_config, drawables_config, bookmarks_config, editable) {
                var _this5 = this;

                // Create view.
                this.view = new _tracks2.default.TracksterView(_.extend(view_config, {
                    header: false
                }));
                this.view.editor = true;

                $.when(this.view.load_chroms_deferred).then(function(chrom_info) {
                    var overview_drawable_name = null;
                    // Viewport config.
                    if (viewport_config) {
                        var chrom = viewport_config.chrom;
                        var start = viewport_config.start;
                        var end = viewport_config.end;
                        overview_drawable_name = viewport_config.overview;

                        if (chrom && start !== undefined && end) {
                            _this5.view.change_chrom(chrom, start, end);
                        } else {
                            // No valid viewport, so use first chromosome.
                            _this5.view.change_chrom(chrom_info[0].chrom);
                        }
                    } else {
                        // No viewport, so use first chromosome.
                        _this5.view.change_chrom(chrom_info[0].chrom);
                    }

                    // Add drawables to view.
                    if (drawables_config) {
                        // FIXME: can from_dict() be used to create view and add drawables?
                        for (var i = 0; i < drawables_config.length; i++) {
                            _this5.view.add_drawable(_tracks2.default.object_from_template(drawables_config[i], _this5.view, _this5.view));
                        }
                    }

                    // Set overview.
                    for (var _i = 0; _i < _this5.view.drawables.length; _i++) {
                        if (_this5.view.drawables[_i].config.get_value("name") === overview_drawable_name) {
                            _this5.view.set_overview(_this5.view.drawables[_i]);
                            break;
                        }
                    }

                    // Load bookmarks.
                    if (bookmarks_config) {
                        var bookmark;
                        for (var _i2 = 0; _i2 < bookmarks_config.length; _i2++) {
                            bookmark = bookmarks_config[_i2];
                            _this5.add_bookmark(bookmark.position, bookmark.annotation, editable);
                        }
                    }

                    // View has no changes as of yet.
                    _this5.view.has_changes = false;
                });

                // Final initialization.
                this.set_up_router({
                    view: this.view
                });

                // TODO: This is hopefully not necessary anymore, since we're using the instance view.  Do it for compatibility for now.
                return this.view;
            }
        }, {
            key: "set_up_router",
            value: function set_up_router(options) {
                new _visualization2.default.TrackBrowserRouter(options);
                Backbone.history.start();
            }
        }, {
            key: "init_keyboard_nav",
            value: function init_keyboard_nav(view) {
                // Keyboard navigation. Scroll ~7% of height when scrolling up/down.
                $(document).keyup(function(e) {
                    // Do not navigate if arrow keys used in input element.
                    if ($(e.srcElement).is(":input")) {
                        return;
                    }

                    // Key codes: left == 37, up == 38, right == 39, down == 40
                    switch (e.which) {
                        case 37:
                            view.move_fraction(0.25);
                            break;
                        case 38:
                            // var change = Math.round(view.viewport_container.height() / 15.0);
                            view.viewport_container.scrollTop(view.viewport_container.scrollTop() - 20);
                            break;
                        case 39:
                            view.move_fraction(-0.25);
                            break;
                        case 40:
                            // var change = Math.round(view.viewport_container.height() / 15.0);
                            view.viewport_container.scrollTop(view.viewport_container.scrollTop() + 20);
                            break;
                    }
                });
            }
        }, {
            key: "handle_unsaved_changes",
            value: function handle_unsaved_changes(view) {
                var _this6 = this;

                if (view.has_changes) {
                    Galaxy.modal.show({
                        title: (0, _localization2.default)("Close visualization"),
                        body: "There are unsaved changes to your visualization which will be lost if you do not save them.",
                        buttons: {
                            Cancel: function Cancel() {
                                Galaxy.modal.hide();
                            },
                            "Leave without Saving": function LeaveWithoutSaving() {
                                $(window).off("beforeunload");
                                window.location = Galaxy.root + "visualization";
                            },
                            Save: function Save() {
                                $.when(_this6.save_viz()).then(function() {
                                    window.location = Galaxy.root + "visualization";
                                });
                            }
                        }
                    });
                } else {
                    window.location = Galaxy.root + "visualization";
                }
            }
        }]);

        return TracksterUI;
    }(Backbone.Model);

    var TracksterUIView = function(_Backbone$View) {
        _inherits(TracksterUIView, _Backbone$View);

        function TracksterUIView(options) {
            _classCallCheck(this, TracksterUIView);

            return _possibleConstructorReturn(this, (TracksterUIView.__proto__ || Object.getPrototypeOf(TracksterUIView)).call(this, options));
        }
        // initalize trackster


        _createClass(TracksterUIView, [{
            key: "initialize",
            value: function initialize() {
                var _this8 = this;

                // load ui
                this.ui = new TracksterUI(Galaxy.root);

                // create button menu
                this.ui.createButtonMenu();

                // attach the button menu to the panel header and float it left
                this.ui.buttonMenu.$el.attr("style", "float: right");

                // add to center panel
                $("#center .unified-panel-header-inner").append(this.ui.buttonMenu.$el);

                // configure right panel
                $("#right .unified-panel-title").append("Bookmarks");
                $("#right .unified-panel-icons").append("<a id='add-bookmark-button' class='icon-button menu-button plus-button' href='javascript:void(0);' title='Add bookmark'></a>");

                // resize view when showing/hiding right panel (bookmarks for now).
                $("#right-border").click(function() {
                    _this8.ui.view.resize_window();
                });

                // hide right panel
                window.force_right_panel("hide");

                // check if id is available
                if (window.galaxy_config.app.id) {
                    this.view_existing();
                } else if (_queryStringParsing2.default.get("dataset_id")) {
                    this.choose_existing_or_new();
                } else {
                    this.view_new();
                }
            }
        }, {
            key: "choose_existing_or_new",
            value: function choose_existing_or_new() {
                var _this9 = this;

                var dbkey = _queryStringParsing2.default.get("dbkey");
                var listTracksParams = {};

                var dataset_params = {
                    dbkey: dbkey,
                    dataset_id: _queryStringParsing2.default.get("dataset_id"),
                    hda_ldda: _queryStringParsing2.default.get("hda_ldda"),
                    gene_region: _queryStringParsing2.default.get("gene_region")
                };

                if (dbkey) {
                    listTracksParams["f-dbkey"] = dbkey;
                }

                Galaxy.modal.show({
                    title: "View Data in a New or Saved Visualization?",
                    // either have text in here or have to remove body and the header/footer margins
                    body: "<p><ul style='list-style: disc inside none'>You can add this dataset as:<li>a new track to one of your existing, saved Trackster sessions if they share the genome build: <b>" + (dbkey || "Not available.") + "</b></li><li>or create a new session with this dataset as the only track</li></ul></p>",
                    buttons: {
                        Cancel: function Cancel() {
                            window.location = Galaxy.root + "visualizations/list";
                        },
                        "View in saved visualization": function ViewInSavedVisualization() {
                            _this9.view_in_saved(dataset_params);
                        },
                        "View in new visualization": function ViewInNewVisualization() {
                            _this9.view_new();
                        }
                    }
                });
            }
        }, {
            key: "view_in_saved",
            value: function view_in_saved(dataset_params) {
                var _this10 = this;

                var tracks_grid = new _gridView2.default({
                    url_base: Galaxy.root + "visualization/list_tracks",
                    embedded: true
                });
                Galaxy.modal.show({
                    title: (0, _localization2.default)("Add Data to Saved Visualization"),
                    body: tracks_grid.$el,
                    buttons: {
                        Cancel: function Cancel() {
                            window.location = Galaxy.root + "visualizations/list";
                        },
                        "Add to visualization": function AddToVisualization() {
                            $(window.parent.document).find("input[name=id]:checked").each(function() {
                                dataset_params.id = $(_this10).val();
                                window.location = Galaxy.root + "visualization/trackster?" + $.param(dataset_params);
                            });
                        }
                    }
                });
            }
        }, {
            key: "view_existing",
            value: function view_existing() {
                // get config
                var viz_config = window.galaxy_config.app.viz_config;

                // view
                this.ui.create_visualization({
                    container: $("#center .unified-panel-body"),
                    name: viz_config.title,
                    vis_id: viz_config.vis_id,
                    dbkey: viz_config.dbkey
                }, viz_config.viewport, viz_config.tracks, viz_config.bookmarks, true);

                // initialize editor
                this.init_editor();
            }
        }, {
            key: "view_new",
            value: function view_new() {
                var _this11 = this;

                // ajax
                $.ajax({
                    url: Galaxy.root + "api/genomes?chrom_info=True",
                    data: {},
                    error: function error() {
                        alert("Couldn't create new browser.");
                    },
                    success: function success(response) {
                        // show dialog
                        Galaxy.modal.show({
                            title: (0, _localization2.default)("New Visualization"),
                            body: _this11.template_view_new(response),
                            buttons: {
                                Cancel: function Cancel() {
                                    window.location = Galaxy.root + "visualizations/list";
                                },
                                Create: function Create() {
                                    _this11.create_browser($("#new-title").val(), $("#new-dbkey").val());
                                    Galaxy.modal.hide();
                                }
                            }
                        });

                        // select default
                        var dbkeys_in_genomes = response.map(function(r) {
                            return r[1];
                        });
                        if (window.galaxy_config.app.default_dbkey && _.contains(dbkeys_in_genomes, window.galaxy_config.app.default_dbkey)) {
                            $("#new-dbkey").val(window.galaxy_config.app.default_dbkey);
                        }

                        // change focus
                        $("#new-title").focus();
                        $("select[name='dbkey']").select2();

                        // to support the large number of options for dbkey, enable scrolling in overlay.
                        $("#overlay").css("overflow", "auto");
                    }
                });
            }
        }, {
            key: "template_view_new",
            value: function template_view_new(response) {
                // start template
                var html = '<form id="new-browser-form" action="javascript:void(0);" method="post" onsubmit="return false;">' + '<div class="form-row">' + '<label for="new-title">Browser name:</label>' + '<div class="form-row-input">' + '<input type="text" name="title" id="new-title" value="Unnamed"></input>' + "</div>" + '<div style="clear: both;"></div>' + "</div>" + '<div class="form-row">' + '<label for="new-dbkey">Reference genome build (dbkey): </label>' + '<div class="form-row-input">' + '<select name="dbkey" id="new-dbkey">';

                // add dbkeys
                for (var i = 0; i < response.length; i++) {
                    html += "<option value=\"" + response[i][1] + "\">" + response[i][0] + "</option>";
                }

                // close selection/finalize template
                html += "</select></div><div style=\"clear: both;\"></div></div><div class=\"form-row\">Is the build not listed here? <a href=\"" + Galaxy.root + "custom_builds\">Add a Custom Build</a></div></form>";

                // return
                return html;
            }
        }, {
            key: "init_editor",
            value: function init_editor() {
                var _this12 = this;

                // set title
                $("#center .unified-panel-title").text(this.ui.view.config.get_value("name") + " (" + this.ui.view.dbkey + ")");

                // add dataset
                if (window.galaxy_config.app.add_dataset) $.ajax({
                    url: Galaxy.root + "api/datasets/" + window.galaxy_config.app.add_dataset,
                    data: {
                        hda_ldda: "hda",
                        data_type: "track_config"
                    },
                    dataType: "json",
                    success: function success(track_data) {
                        _this12.ui.view.add_drawable(_tracks2.default.object_from_template(track_data, _this12.ui.view, _this12.ui.view));
                    }
                });

                // initialize icons
                $("#add-bookmark-button").click(function() {
                    // add new bookmark.
                    var position = _this12.ui.view.chrom + ":" + _this12.ui.view.low + "-" + _this12.ui.view.high;

                    var annotation = "Bookmark description";
                    return _this12.ui.add_bookmark(position, annotation, true);
                });

                // initialize keyboard
                this.ui.init_keyboard_nav(this.ui.view);

                $(window).on("beforeunload", function() {
                    if (_this12.ui.view.has_changes) {
                        return "There are unsaved changes to your visualization that will be lost if you leave this page.";
                    }
                });
            }
        }, {
            key: "create_browser",
            value: function create_browser(name, dbkey) {
                $(document).trigger("convert_to_values");

                this.ui.create_visualization({
                    container: $("#center .unified-panel-body"),
                    name: name,
                    dbkey: dbkey
                }, window.galaxy_config.app.gene_region);

                // initialize editor
                this.init_editor();

                // modify view setting
                this.ui.view.editor = true;
            }
        }]);

        return TracksterUIView;
    }(Backbone.View);

    exports.default = {
        TracksterUI: TracksterUI,
        GalaxyApp: TracksterUIView
    };
});
//# sourceMappingURL=../../maps/viz/trackster.js.map
