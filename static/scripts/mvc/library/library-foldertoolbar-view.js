define("mvc/library/library-foldertoolbar-view", ["exports", "utils/localization", "utils/utils", "libs/toastr", "mvc/library/library-model", "mvc/ui/ui-select", "mvc/collection/list-collection-creator", "mvc/collection/pair-collection-creator", "mvc/collection/list-of-pairs-collection-creator", "mvc/history/hdca-model", "libs/jquery/jstree"], function(exports, _localization, _utils, _toastr, _libraryModel, _uiSelect, _listCollectionCreator, _pairCollectionCreator, _listOfPairsCollectionCreator, _hdcaModel) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _localization2 = _interopRequireDefault(_localization);

    var _utils2 = _interopRequireDefault(_utils);

    var _toastr2 = _interopRequireDefault(_toastr);

    var _libraryModel2 = _interopRequireDefault(_libraryModel);

    var _uiSelect2 = _interopRequireDefault(_uiSelect);

    var _listCollectionCreator2 = _interopRequireDefault(_listCollectionCreator);

    var _pairCollectionCreator2 = _interopRequireDefault(_pairCollectionCreator);

    var _listOfPairsCollectionCreator2 = _interopRequireDefault(_listOfPairsCollectionCreator);

    var _hdcaModel2 = _interopRequireDefault(_hdcaModel);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var FolderToolbarView = Backbone.View.extend({
        el: "#center",

        events: {
            "click .toolbtn-create-folder": "createFolderFromModal",
            "click .toolbtn-bulk-import": "importToHistoryModal",
            "click .include-deleted-datasets-chk": "checkIncludeDeleted",
            "click .toolbtn-bulk-delete": "deleteSelectedItems",
            "click .toolbtn-show-locinfo": "showLocInfo",
            "click .page-size-prompt": "showPageSizePrompt",
            "click .toolbtn-collection-import": "showCollectionSelect"
        },

        defaults: {
            can_add_library_item: false,
            contains_file_or_folder: false,
            chain_call_control: {
                total_number: 0,
                failed_number: 0
            },
            disabled_jstree_element: "folders"
        },

        modal: null,

        // directory browsing object
        jstree: null,

        // user's histories
        histories: null,

        // genome select
        select_genome: null,

        // extension select
        select_extension: null,

        // extension types
        list_extensions: [],

        // datatype placeholder for extension auto-detection
        auto: {
            id: "auto",
            text: "Auto-detect",
            description: "This system will try to detect the file type automatically." + " If your file is not detected properly as one of the known formats," + " it most likely means that it has some format problems (e.g., different" + " number of columns on different rows). You can still coerce the system" + " to set your data to the format you think it should be." + " You can also upload compressed files, which will automatically be decompressed."
        },

        // genomes
        list_genomes: [],

        initialize: function initialize(options) {
            this.options = _.defaults(options || {}, this.defaults);
            this.fetchExtAndGenomes();
            this.render();
        },

        render: function render(options) {
            this.options = _.extend(this.options, options);
            var toolbar_template = this.templateToolBar();
            var template_defaults = {
                id: this.options.id,
                is_admin: false,
                is_anonym: true,
                mutiple_add_dataset_options: false
            };
            if (Galaxy.user) {
                template_defaults.is_admin = Galaxy.user.isAdmin();
                template_defaults.is_anonym = Galaxy.user.isAnonymous();
                if (Galaxy.config.user_library_import_dir !== null || Galaxy.config.allow_library_path_paste !== false || Galaxy.config.library_import_dir !== null) {
                    template_defaults.mutiple_add_dataset_options = true;
                }
            }
            this.$el.html(toolbar_template(template_defaults));
        },

        /**
         * Called from FolderListView when needed.
         * @param  {object} options common options
         */
        renderPaginator: function renderPaginator(options) {
            this.options = _.extend(this.options, options);
            var paginator_template = this.templatePaginator();
            $("body").find(".folder-paginator").html(paginator_template({
                id: this.options.id,
                show_page: parseInt(this.options.show_page),
                page_count: parseInt(this.options.page_count),
                total_items_count: this.options.total_items_count,
                items_shown: this.options.items_shown,
                folder_page_size: Galaxy.libraries.preferences.get("folder_page_size")
            }));
        },

        configureElements: function configureElements(options) {
            this.options = _.extend(this.options, options);

            if (this.options.can_add_library_item === true) {
                $(".add-library-items").show();
            } else {
                $(".add-library-items").hide();
            }
            if (this.options.contains_file_or_folder === true) {
                if (Galaxy.user) {
                    if (!Galaxy.user.isAnonymous()) {
                        $(".logged-dataset-manipulation").show();
                        $(".dataset-manipulation").show();
                    } else {
                        $(".dataset-manipulation").show();
                        $(".logged-dataset-manipulation").hide();
                    }
                } else {
                    $(".logged-dataset-manipulation").hide();
                    $(".dataset-manipulation").hide();
                }
            } else {
                $(".logged-dataset-manipulation").hide();
                $(".dataset-manipulation").hide();
            }
            this.$el.find("[data-toggle]").tooltip();
        },

        createFolderFromModal: function createFolderFromModal(event) {
            var _this = this;

            event.preventDefault();
            event.stopPropagation();
            var template = this.templateNewFolderInModal();
            this.modal = Galaxy.modal;
            this.modal.show({
                closing_events: true,
                title: (0, _localization2.default)("Create New Folder"),
                body: template(),
                buttons: {
                    Create: function Create() {
                        _this.createNewFolderEvent();
                    },
                    Close: function Close() {
                        Galaxy.modal.hide();
                    }
                }
            });
        },

        createNewFolderEvent: function createNewFolderEvent() {
            var folderDetails = this.serializeNewFolder();
            if (this.validateNewFolder(folderDetails)) {
                var folder = new _libraryModel2.default.FolderAsModel();
                var url_items = Backbone.history.fragment.split("/");
                var current_folder_id;
                if (url_items.indexOf("page") > -1) {
                    current_folder_id = url_items[url_items.length - 3];
                } else {
                    current_folder_id = url_items[url_items.length - 1];
                }
                folder.url = folder.urlRoot + current_folder_id;

                folder.save(folderDetails, {
                    success: function success(folder) {
                        Galaxy.modal.hide();
                        _toastr2.default.success("Folder created.");
                        folder.set({
                            type: "folder"
                        });
                        Galaxy.libraries.folderListView.collection.add(folder);
                    },
                    error: function error(model, response) {
                        Galaxy.modal.hide();
                        if (typeof response.responseJSON !== "undefined") {
                            _toastr2.default.error(response.responseJSON.err_msg);
                        } else {
                            _toastr2.default.error("An error occurred.");
                        }
                    }
                });
            } else {
                _toastr2.default.error("Folder's name is missing.");
            }
            return false;
        },

        serializeNewFolder: function serializeNewFolder() {
            return {
                name: $("input[name='Name']").val(),
                description: $("input[name='Description']").val()
            };
        },

        validateNewFolder: function validateNewFolder(folderDetails) {
            return folderDetails.name !== "";
        },

        importToHistoryModal: function importToHistoryModal(e) {
            var _this2 = this;

            e.preventDefault();
            var $checkedValues = this.findCheckedRows();
            var template = this.templateImportIntoHistoryModal();
            if ($checkedValues.length === 0) {
                _toastr2.default.info("You must select some datasets first.");
            } else {
                var promise = this.fetchUserHistories();
                promise.done(function() {
                    _this2.modal = Galaxy.modal;
                    _this2.modal.show({
                        closing_events: true,
                        title: (0, _localization2.default)("Import into History"),
                        body: template({
                            histories: _this2.histories.models
                        }),
                        buttons: {
                            Import: function Import() {
                                _this2.importAllIntoHistory();
                            },
                            Close: function Close() {
                                Galaxy.modal.hide();
                            }
                        }
                    });
                }).fail(function(model, response) {
                    if (typeof response.responseJSON !== "undefined") {
                        _toastr2.default.error(response.responseJSON.err_msg);
                    } else {
                        _toastr2.default.error("An error occurred.");
                    }
                });
            }
        },

        fetchUserHistories: function fetchUserHistories() {
            this.histories = new _libraryModel2.default.GalaxyHistories();
            var promise = this.histories.fetch();
            return promise;
        },

        importAllIntoHistory: function importAllIntoHistory() {
            var _this3 = this;

            this.modal.disableButton("Import");
            var new_history_name = this.modal.$("input[name=history_name]").val();
            if (new_history_name !== "") {
                this.createNewHistory(new_history_name).done(function(new_history) {
                    _this3.processImportToHistory(new_history.id, new_history.name);
                }).fail(function(xhr, status, error) {
                    _toastr2.default.error("An error occurred.");
                }).always(function() {
                    _this3.modal.enableButton("Import");
                });
            } else {
                var history_id = $("select[name=import_to_history] option:selected").val();
                var history_name = $("select[name=import_to_history] option:selected").text();
                this.processImportToHistory(history_id, history_name);
                this.modal.enableButton("Import");
            }
        },

        createNewHistory: function createNewHistory(new_history_name) {
            var promise = $.post(Galaxy.root + "api/histories", {
                name: new_history_name
            });
            return promise;
        },

        processImportToHistory: function processImportToHistory(history_id, history_name) {
            var checked_items = this.findCheckedItems();
            var items_to_import = [];
            // prepare the dataset objects to be imported
            for (var i = checked_items.dataset_ids.length - 1; i >= 0; i--) {
                var library_dataset_id = checked_items.dataset_ids[i];
                var historyItem = new _libraryModel2.default.HistoryItem();
                historyItem.url = historyItem.urlRoot + history_id + "/contents";
                historyItem.content = library_dataset_id;
                historyItem.source = "library";
                items_to_import.push(historyItem);
            }
            // prepare the folder objects to be imported
            for (var _i = checked_items.folder_ids.length - 1; _i >= 0; _i--) {
                var library_folder_id = checked_items.folder_ids[_i];
                var historyItem = new _libraryModel2.default.HistoryItem();
                historyItem.url = historyItem.urlRoot + history_id + "/contents";
                historyItem.content = library_folder_id;
                historyItem.source = "library_folder";
                items_to_import.push(historyItem);
            }
            this.initChainCallControl({
                length: items_to_import.length,
                action: "to_history",
                history_name: history_name
            });
            // set the used history as current so user will see the last one
            // that he imported into in the history panel on the 'analysis' page
            jQuery.getJSON(Galaxy.root + "history/set_as_current?id=" + history_id);
            this.chainCallImportingIntoHistory(items_to_import, history_name);
        },

        /**
         * Update progress bar in modal.
         */
        updateProgress: function updateProgress() {
            this.progress += this.progressStep;
            $(".progress-bar-import").width(Math.round(this.progress) + "%");
            var txt_representation = Math.round(this.progress) + "% Complete";
            $(".completion_span").text(txt_representation);
        },

        /**
         * Download selected datasets. Called from the router.
         * @param  {str} format    requested archive format
         */
        download: function download(format) {
            var checked_items = this.findCheckedItems();
            var url = Galaxy.root + "api/libraries/datasets/download/" + format;
            var data = {
                ld_ids: checked_items.dataset_ids,
                folder_ids: checked_items.folder_ids
            };
            this.processDownload(url, data, "get");
        },

        /**
         * Create hidden form and submit it through POST
         * to initialize the download.
         * @param  {str} url    url to call
         * @param  {obj} data   data to include in the request
         * @param  {str} method method of the request
         */
        processDownload: function processDownload(url, data, method) {
            if (url && data) {
                // data can be string of parameters or array/object
                data = typeof data === "string" ? data : $.param(data);
                // split params into form inputs
                var inputs = "";
                $.each(data.split("&"), function() {
                    var pair = this.split("=");
                    inputs += "<input type=\"hidden\" name=\"" + pair[0] + "\" value=\"" + pair[1] + "\" />";
                });
                // send request
                $("<form action=\"" + url + "\" method=\"" + (method || "post") + "\">" + inputs + "</form>").appendTo("body").submit().remove();
                _toastr2.default.info("Your download will begin soon.");
            } else {
                _toastr2.default.error("An error occurred.");
            }
        },

        addFilesFromHistoryModal: function addFilesFromHistoryModal() {
            var _this4 = this;

            this.histories = new _libraryModel2.default.GalaxyHistories();
            this.histories.fetch().done(function() {
                _this4.modal = Galaxy.modal;
                var template_modal = _this4.templateAddFilesFromHistory();
                _this4.modal.show({
                    closing_events: true,
                    title: (0, _localization2.default)("Adding datasets from your history"),
                    body: template_modal({
                        histories: _this4.histories.models
                    }),
                    buttons: {
                        Add: function Add() {
                            _this4.addAllDatasetsFromHistory();
                        },
                        Close: function Close() {
                            Galaxy.modal.hide();
                        }
                    },
                    closing_callback: function closing_callback() {
                        Galaxy.libraries.library_router.navigate("folders/" + _this4.id, {
                            trigger: true
                        });
                    }
                });
                _this4.fetchAndDisplayHistoryContents(_this4.histories.models[0].id);
                $("#dataset_add_bulk").change(function(event) {
                    _this4.fetchAndDisplayHistoryContents(event.target.value);
                });
            }).fail(function(model, response) {
                if (typeof response.responseJSON !== "undefined") {
                    _toastr2.default.error(response.responseJSON.err_msg);
                } else {
                    _toastr2.default.error("An error occurred.");
                }
            });
        },

        /**
         * Create modal for importing from Galaxy path.
         */
        importFilesFromPathModal: function importFilesFromPathModal() {
            var _this5 = this;

            this.modal = Galaxy.modal;
            var template_modal = this.templateImportPathModal();
            this.modal.show({
                closing_events: true,
                title: (0, _localization2.default)("Please enter paths to import"),
                body: template_modal({}),
                buttons: {
                    Import: function Import() {
                        _this5.importFromPathsClicked(_this5);
                    },
                    Close: function Close() {
                        Galaxy.modal.hide();
                    }
                },
                closing_callback: function closing_callback() {
                    //  TODO: should not trigger routes outside of the router
                    Galaxy.libraries.library_router.navigate("folders/" + _this5.id, {
                        trigger: true
                    });
                }
            });
            this.renderSelectBoxes();
        },

        /**
         * Request all extensions and genomes from Galaxy
         * and save them in sorted arrays.
         */
        fetchExtAndGenomes: function fetchExtAndGenomes() {
            var _this6 = this;

            _utils2.default.get({
                url: Galaxy.root + "api/datatypes?extension_only=False",
                success: function success(datatypes) {
                    _this6.list_extensions = [];
                    for (var key in datatypes) {
                        _this6.list_extensions.push({
                            id: datatypes[key].extension,
                            text: datatypes[key].extension,
                            description: datatypes[key].description,
                            description_url: datatypes[key].description_url
                        });
                    }
                    _this6.list_extensions.sort(function(a, b) {
                        return a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
                    });
                    _this6.list_extensions.unshift(_this6.auto);
                },
                cache: true
            });
            _utils2.default.get({
                url: Galaxy.root + "api/genomes",
                success: function success(genomes) {
                    _this6.list_genomes = [];
                    for (var key in genomes) {
                        _this6.list_genomes.push({
                            id: genomes[key][1],
                            text: genomes[key][0]
                        });
                    }
                    _this6.list_genomes.sort(function(a, b) {
                        return a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
                    });
                },
                cache: true
            });
        },

        renderSelectBoxes: function renderSelectBoxes() {
            // This won't work properly unlesss we already have the data fetched.
            // See this.fetchExtAndGenomes()
            this.select_genome = new _uiSelect2.default.View({
                css: "library-genome-select",
                data: this.list_genomes,
                container: Galaxy.modal.$el.find("#library_genome_select"),
                value: "?"
            });
            this.select_extension = new _uiSelect2.default.View({
                css: "library-extension-select",
                data: this.list_extensions,
                container: Galaxy.modal.$el.find("#library_extension_select"),
                value: "auto"
            });
        },

        /**
         * Create modal for importing from given directory
         * on Galaxy. Bind jQuery events.
         */
        importFilesFromGalaxyFolderModal: function importFilesFromGalaxyFolderModal(options) {
            var _this7 = this;

            var template_modal = this.templateBrowserModal();
            this.modal = Galaxy.modal;
            this.modal.show({
                closing_events: true,
                title: (0, _localization2.default)("Please select folders or files"),
                body: template_modal({}),
                buttons: {
                    Import: function Import() {
                        _this7.importFromJstreePath(_this7, options);
                    },
                    Close: function Close() {
                        Galaxy.modal.hide();
                    }
                },
                closing_callback: function closing_callback() {
                    //  TODO: should not trigger routes outside of the router
                    Galaxy.libraries.library_router.navigate("folders/" + _this7.id, {
                        trigger: true
                    });
                }
            });

            $(".libimport-select-all").bind("click", function() {
                $("#jstree_browser").jstree("check_all");
            });
            $(".libimport-select-none").bind("click", function() {
                $("#jstree_browser").jstree("uncheck_all");
            });

            this.renderSelectBoxes();
            options.disabled_jstree_element = "folders";
            this.renderJstree(options);

            $("input[type=radio]").change(function(event) {
                if (event.target.value === "jstree-disable-folders") {
                    options.disabled_jstree_element = "folders";
                    _this7.renderJstree(options);
                    $(".jstree-folders-message").hide();
                    $(".jstree-preserve-structure").hide();
                    $(".jstree-files-message").show();
                } else if (event.target.value === "jstree-disable-files") {
                    $(".jstree-files-message").hide();
                    $(".jstree-folders-message").show();
                    $(".jstree-preserve-structure").show();
                    options.disabled_jstree_element = "files";
                    _this7.renderJstree(options);
                }
            });
        },

        /**
         * Fetch the contents of user directory on Galaxy
         * and render jstree component based on received
         * data.
         * @param  {[type]} options [description]
         */
        renderJstree: function renderJstree(options) {
            this.options = _.extend(this.options, options);
            var target = options.source || "userdir";
            var disabled_jstree_element = this.options.disabled_jstree_element;
            this.jstree = new _libraryModel2.default.Jstree();
            this.jstree.url = this.jstree.urlRoot + "?target=" + target + "&format=jstree&disable=" + disabled_jstree_element;
            this.jstree.fetch({
                success: function success(model, response) {
                    $("#jstree_browser").jstree("destroy");
                    $("#jstree_browser").jstree({
                        core: {
                            data: model
                        },
                        plugins: ["types", "checkbox"],
                        types: {
                            folder: {
                                icon: "jstree-folder"
                            },
                            file: {
                                icon: "jstree-file"
                            }
                        },
                        checkbox: {
                            three_state: false
                        }
                    });
                },
                error: function error(model, response) {
                    if (typeof response.responseJSON !== "undefined") {
                        if (response.responseJSON.err_code === 404001) {
                            _toastr2.default.warning(response.responseJSON.err_msg);
                        } else {
                            _toastr2.default.error(response.responseJSON.err_msg);
                        }
                    } else {
                        _toastr2.default.error("An error occurred.");
                    }
                }
            });
        },

        /**
         * Take the paths from the textarea, split it, create
         * a request queue and call a function that starts sending
         * one by one to be imported on the server.
         */
        importFromPathsClicked: function importFromPathsClicked() {
            var preserve_dirs = this.modal.$el.find(".preserve-checkbox").is(":checked");
            var link_data = this.modal.$el.find(".link-checkbox").is(":checked");
            var space_to_tab = this.modal.$el.find(".spacetab-checkbox").is(":checked");
            var to_posix_lines = this.modal.$el.find(".posix-checkbox").is(":checked");
            var tag_using_filenames = this.modal.$el.find(".tag-files").is(":checked");
            var file_type = this.select_extension.value();
            var dbkey = this.select_genome.value();
            var paths = $("textarea#import_paths").val();
            var valid_paths = [];
            if (!paths) {
                _toastr2.default.info("Please enter a path relative to Galaxy root.");
            } else {
                this.modal.disableButton("Import");
                paths = paths.split("\n");
                for (var i = paths.length - 1; i >= 0; i--) {
                    var trimmed = paths[i].trim();
                    if (trimmed.length !== 0) {
                        valid_paths.push(trimmed);
                    }
                }
                this.initChainCallControl({
                    length: valid_paths.length,
                    action: "adding_datasets"
                });
                this.chainCallImportingFolders({
                    paths: valid_paths,
                    preserve_dirs: preserve_dirs,
                    link_data: link_data,
                    space_to_tab: space_to_tab,
                    to_posix_lines: to_posix_lines,
                    source: "admin_path",
                    file_type: file_type,
                    tag_using_filenames: tag_using_filenames,
                    dbkey: dbkey
                });
            }
        },

        /**
         * Initialize the control of chaining requests
         * in the current modal.
         * @param {int} length The number of items in the chain call.
         */
        initChainCallControl: function initChainCallControl(options) {
            var template;
            switch (options.action) {
                case "adding_datasets":
                    template = this.templateAddingDatasetsProgressBar();
                    this.modal.$el.find(".modal-body").html(template({
                        folder_name: this.options.folder_name
                    }));
                    break;
                case "deleting_datasets":
                    template = this.templateDeletingItemsProgressBar();
                    this.modal.$el.find(".modal-body").html(template());
                    break;
                case "to_history":
                    template = this.templateImportIntoHistoryProgressBar();
                    this.modal.$el.find(".modal-body").html(template({
                        history_name: options.history_name
                    }));
                    break;
                default:
                    Galaxy.emit.error("Wrong action specified.", "datalibs");
                    break;
            }

            // var progress_bar_tmpl = this.templateAddingDatasetsProgressBar();
            // this.modal.$el.find( '.modal-body' ).html( progress_bar_tmpl( { folder_name : this.options.folder_name } ) );
            this.progress = 0;
            this.progressStep = 100 / options.length;
            this.options.chain_call_control.total_number = options.length;
            this.options.chain_call_control.failed_number = 0;
        },

        /**
         * Take the selected items from the jstree, create a request queue
         * and send them one by one to the server for importing into
         * the current folder.
         *
         * jstree.js has to be loaded before
         * @see renderJstree
         */
        importFromJstreePath: function importFromJstreePath(that, options) {
            var all_nodes = $("#jstree_browser").jstree().get_selected(true);
            // remove the disabled elements that could have been trigerred with the 'select all'
            var selected_nodes = _.filter(all_nodes, function(node) {
                return node.state.disabled == false;
            });
            var preserve_dirs = this.modal.$el.find(".preserve-checkbox").is(":checked");
            var link_data = this.modal.$el.find(".link-checkbox").is(":checked");
            var space_to_tab = this.modal.$el.find(".spacetab-checkbox").is(":checked");
            var to_posix_lines = this.modal.$el.find(".posix-checkbox").is(":checked");
            var file_type = this.select_extension.value();
            var dbkey = this.select_genome.value();
            var tag_using_filenames = this.modal.$el.find(".tag-files").is(":checked");
            var selection_type = selected_nodes[0].type;
            var paths = [];
            if (selected_nodes.length < 1) {
                _toastr2.default.info("Please select some items first.");
            } else {
                this.modal.disableButton("Import");
                for (var i = selected_nodes.length - 1; i >= 0; i--) {
                    if (selected_nodes[i].li_attr.full_path !== undefined) {
                        paths.push(selected_nodes[i].li_attr.full_path);
                    }
                }
                this.initChainCallControl({
                    length: paths.length,
                    action: "adding_datasets"
                });
                if (selection_type === "folder") {
                    var full_source = options.source + "_folder";
                    this.chainCallImportingFolders({
                        paths: paths,
                        preserve_dirs: preserve_dirs,
                        link_data: link_data,
                        space_to_tab: space_to_tab,
                        to_posix_lines: to_posix_lines,
                        source: full_source,
                        file_type: file_type,
                        dbkey: dbkey,
                        tag_using_filenames: tag_using_filenames
                    });
                } else if (selection_type === "file") {
                    var full_source = options.source + "_file";
                    this.chainCallImportingUserdirFiles({
                        paths: paths,
                        file_type: file_type,
                        dbkey: dbkey,
                        link_data: link_data,
                        space_to_tab: space_to_tab,
                        to_posix_lines: to_posix_lines,
                        source: full_source,
                        tag_using_filenames: tag_using_filenames
                    });
                }
            }
        },

        fetchAndDisplayHistoryContents: function fetchAndDisplayHistoryContents(history_id) {
            var _this8 = this;

            var history_contents = new _libraryModel2.default.HistoryContents({
                id: history_id
            });
            history_contents.fetch({
                success: function success(history_contents) {
                    var history_contents_template = _this8.templateHistoryContents();
                    _this8.histories.get(history_id).set({
                        contents: history_contents
                    });
                    _this8.modal.$el.find(".library_selected_history_content").html(history_contents_template({
                        history_contents: history_contents.models.reverse()
                    }));
                    _this8.modal.$el.find(".history-import-select-all").bind("click", function() {
                        $(".library_selected_history_content [type=checkbox]").prop("checked", true);
                    });
                    _this8.modal.$el.find(".history-import-unselect-all").bind("click", function() {
                        $(".library_selected_history_content [type=checkbox]").prop("checked", false);
                    });
                },
                error: function error(model, response) {
                    if (typeof response.responseJSON !== "undefined") {
                        _toastr2.default.error(response.responseJSON.err_msg);
                    } else {
                        _toastr2.default.error("An error occurred.");
                    }
                }
            });
        },

        /**
         * Import all selected datasets from history into the current folder.
         */
        addAllDatasetsFromHistory: function addAllDatasetsFromHistory() {
            var checked_hdas = this.modal.$el.find(".library_selected_history_content").find(":checked");
            var history_item_ids = []; // can be hda or hdca
            var history_item_types = [];
            var items_to_add = [];
            if (checked_hdas.length < 1) {
                _toastr2.default.info("You must select some datasets first.");
            } else {
                this.modal.disableButton("Add");
                checked_hdas.each(function() {
                    var hid = $(this).closest("li").data("id");
                    if (hid) {
                        var item_type = $(this).closest("li").data("name");
                        history_item_ids.push(hid);
                        history_item_types.push(item_type);
                    }
                });
                for (var i = history_item_ids.length - 1; i >= 0; i--) {
                    var history_item_id = history_item_ids[i];
                    var folder_item = new _libraryModel2.default.Item();
                    folder_item.url = Galaxy.root + "api/folders/" + this.options.id + "/contents";
                    if (history_item_types[i] === "collection") {
                        folder_item.set({
                            from_hdca_id: history_item_id
                        });
                    } else {
                        folder_item.set({
                            from_hda_id: history_item_id
                        });
                    }
                    items_to_add.push(folder_item);
                }
                this.initChainCallControl({
                    length: items_to_add.length,
                    action: "adding_datasets"
                });
                this.chainCallAddingHdas(items_to_add);
            }
        },

        /**
         * Take array of empty history items and make request for each of them
         * to create it on server. Update progress in between calls.
         * @param  {array} history_item_set array of empty history items
         * @param  {str} history_name     name of the history to import to
         */
        chainCallImportingIntoHistory: function chainCallImportingIntoHistory(history_item_set, history_name) {
            var _this9 = this;

            var popped_item = history_item_set.pop();
            if (typeof popped_item == "undefined") {
                if (this.options.chain_call_control.failed_number === 0) {
                    _toastr2.default.success("Selected datasets imported into history. Click this to start analyzing it.", "", {
                        onclick: function onclick() {
                            window.location = Galaxy.root;
                        }
                    });
                } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                    _toastr2.default.error("There was an error and no datasets were imported into history.");
                } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                    _toastr2.default.warning("Some of the datasets could not be imported into history. Click this to see what was imported.", "", {
                        onclick: function onclick() {
                            window.location = Galaxy.root;
                        }
                    });
                }
                Galaxy.modal.hide();
                return true;
            }
            var promise = $.when(popped_item.save({
                content: popped_item.content,
                source: popped_item.source
            }));

            promise.done(function() {
                _this9.updateProgress();
                _this9.chainCallImportingIntoHistory(history_item_set, history_name);
            }).fail(function() {
                _this9.options.chain_call_control.failed_number += 1;
                _this9.updateProgress();
                _this9.chainCallImportingIntoHistory(history_item_set, history_name);
            });
        },

        /**
         * Take the array of paths and create a request for each of them
         * calling them in chain. Update the progress bar in between each.
         * @param  {array} paths                    paths relative to user folder on Galaxy
         * @param  {boolean} tag_using_filenames    add tags to datasets using names of files
         */
        chainCallImportingUserdirFiles: function chainCallImportingUserdirFiles(options) {
            var _this10 = this;

            var popped_item = options.paths.pop();
            if (typeof popped_item === "undefined") {
                if (this.options.chain_call_control.failed_number === 0) {
                    _toastr2.default.success("Selected files imported into the current folder");
                    Galaxy.modal.hide();
                } else {
                    _toastr2.default.error("An error occured.");
                }
                return true;
            }
            var promise = $.when($.post(Galaxy.root + "api/libraries/datasets?encoded_folder_id=" + this.id + "&source=" + options.source + "&path=" + popped_item + "&file_type=" + options.file_type + "&link_data=" + options.link_data + "&space_to_tab=" + options.space_to_tab + "&to_posix_lines=" + options.to_posix_lines + "&dbkey=" + options.dbkey + "&tag_using_filenames=" + options.tag_using_filenames));
            promise.done(function(response) {
                _this10.updateProgress();
                _this10.chainCallImportingUserdirFiles(options);
            }).fail(function() {
                _this10.options.chain_call_control.failed_number += 1;
                _this10.updateProgress();
                _this10.chainCallImportingUserdirFiles(options);
            });
        },

        /**
         * Take the array of paths and create a request for each of them
         * calling them in series. Update the progress bar in between each.
         * @param  {array} paths                    paths relative to Galaxy root folder
         * @param  {boolean} preserve_dirs          indicates whether to preserve folder structure
         * @param  {boolean} link_data              copy files to Galaxy or link instead
         * @param  {boolean} to_posix_lines         convert line endings to POSIX standard
         * @param  {boolean} space_to_tab           convert spaces to tabs
         * @param  {str} source                     string representing what type of folder
         *                                          is the source of import
         * @param  {boolean} tag_using_filenames    add tags to datasets using names of files
         */
        chainCallImportingFolders: function chainCallImportingFolders(options) {
            var _this11 = this;

            // TODO need to check which paths to call
            var popped_item = options.paths.pop();
            if (typeof popped_item == "undefined") {
                if (this.options.chain_call_control.failed_number === 0) {
                    _toastr2.default.success("Selected folders and their contents imported into the current folder.");
                    Galaxy.modal.hide();
                } else {
                    // TODO better error report
                    _toastr2.default.error("An error occured.");
                }
                return true;
            }
            var promise = $.when($.post(Galaxy.root + "api/libraries/datasets?encoded_folder_id=" + this.id + "&source=" + options.source + "&path=" + popped_item + "&preserve_dirs=" + options.preserve_dirs + "&link_data=" + options.link_data + "&to_posix_lines=" + options.to_posix_lines + "&space_to_tab=" + options.space_to_tab + "&file_type=" + options.file_type + "&dbkey=" + options.dbkey + "&tag_using_filenames=" + options.tag_using_filenames));
            promise.done(function(response) {
                _this11.updateProgress();
                _this11.chainCallImportingFolders(options);
            }).fail(function() {
                _this11.options.chain_call_control.failed_number += 1;
                _this11.updateProgress();
                _this11.chainCallImportingFolders(options);
            });
        },

        /**
         * Take the array of hdas and create a request for each.
         * Call them in chain and update progress bar in between each.
         * @param  {array} hdas_set array of empty hda objects
         */
        chainCallAddingHdas: function chainCallAddingHdas(hdas_set) {
            var _this12 = this;

            this.added_hdas = new _libraryModel2.default.Folder();
            var popped_item = hdas_set.pop();
            if (typeof popped_item == "undefined") {
                if (this.options.chain_call_control.failed_number === 0) {
                    _toastr2.default.success("Selected datasets from history added to the folder");
                } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                    _toastr2.default.error("There was an error and no datasets were added to the folder.");
                } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                    _toastr2.default.warning("Some of the datasets could not be added to the folder");
                }
                Galaxy.modal.hide();
                return this.added_hdas;
            }
            var promise = $.when(popped_item.save({
                from_hda_id: popped_item.get("from_hda_id")
            }));

            promise.done(function(model) {
                Galaxy.libraries.folderListView.collection.add(model);
                _this12.updateProgress();
                _this12.chainCallAddingHdas(hdas_set);
            }).fail(function() {
                _this12.options.chain_call_control.failed_number += 1;
                _this12.updateProgress();
                _this12.chainCallAddingHdas(hdas_set);
            });
        },

        /**
         * Take the array of lddas, create request for each and
         * call them in chain. Update progress bar in between each.
         * @param  {array} lddas_set array of lddas to delete
         */
        chainCallDeletingItems: function chainCallDeletingItems(items_to_delete) {
            var _this13 = this;

            this.deleted_items = new _libraryModel2.default.Folder();
            var item_to_delete = items_to_delete.pop();
            if (typeof item_to_delete === "undefined") {
                if (this.options.chain_call_control.failed_number === 0) {
                    _toastr2.default.success("Selected items were deleted.");
                } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                    _toastr2.default.error("There was an error and no items were deleted. Please make sure you have sufficient permissions.");
                } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                    _toastr2.default.warning("Some of the items could not be deleted. Please make sure you have sufficient permissions.");
                }
                Galaxy.modal.hide();
                return this.deleted_items;
            }
            item_to_delete.destroy().done(function(item) {
                Galaxy.libraries.folderListView.collection.remove(item_to_delete.id);
                _this13.updateProgress();
                // add the deleted item to collection, triggers rendering
                if (Galaxy.libraries.folderListView.options.include_deleted) {
                    var updated_item = null;
                    if (item.type === "folder" || item.model_class === "LibraryFolder") {
                        updated_item = new _libraryModel2.default.FolderAsModel(item);
                    } else if (item.type === "file" || item.model_class === "LibraryDataset") {
                        updated_item = new _libraryModel2.default.Item(item);
                    } else {
                        Galaxy.emit.error("Unknown library item type found.", "datalibs");
                        Galaxy.emit.error(item.type || item.model_class, "datalibs");
                    }
                    Galaxy.libraries.folderListView.collection.add(updated_item);
                }
                _this13.chainCallDeletingItems(items_to_delete);
            }).fail(function() {
                _this13.options.chain_call_control.failed_number += 1;
                _this13.updateProgress();
                _this13.chainCallDeletingItems(items_to_delete);
            });
        },

        /**
         * Handles the click on 'show deleted' checkbox
         */
        checkIncludeDeleted: function checkIncludeDeleted(event) {
            if (event.target.checked) {
                Galaxy.libraries.folderListView.fetchFolder({
                    include_deleted: true
                });
            } else {
                Galaxy.libraries.folderListView.fetchFolder({
                    include_deleted: false
                });
            }
        },

        /**
         * Delete the selected items. Atomic. One by one.
         */
        deleteSelectedItems: function deleteSelectedItems() {
            var dataset_ids = [];
            var folder_ids = [];
            var $checkedValues = this.findCheckedRows();
            if ($checkedValues.length === 0) {
                _toastr2.default.info("You must select at least one item for deletion.");
            } else {
                var template = this.templateDeletingItemsProgressBar();
                this.modal = Galaxy.modal;
                this.modal.show({
                    closing_events: true,
                    title: (0, _localization2.default)("Deleting selected items"),
                    body: template({}),
                    buttons: {
                        Close: function Close() {
                            Galaxy.modal.hide();
                        }
                    }
                });
                // init the control counters
                this.options.chain_call_control.total_number = 0;
                this.options.chain_call_control.failed_number = 0;
                $checkedValues.each(function() {
                    var row_id = $(this).closest("tr").data("id");
                    if (row_id !== undefined) {
                        if (row_id.substring(0, 1) == "F") {
                            folder_ids.push(row_id);
                        } else {
                            dataset_ids.push(row_id);
                        }
                    }
                });
                // init the progress bar
                var items_total = dataset_ids.length + folder_ids.length;
                this.progressStep = 100 / items_total;
                this.progress = 0;

                // prepare the dataset items to be added
                var items_to_delete = [];
                for (var i = dataset_ids.length - 1; i >= 0; i--) {
                    var dataset = new _libraryModel2.default.Item({
                        id: dataset_ids[i]
                    });
                    items_to_delete.push(dataset);
                }
                for (var _i2 = folder_ids.length - 1; _i2 >= 0; _i2--) {
                    var folder = new _libraryModel2.default.FolderAsModel({
                        id: folder_ids[_i2]
                    });
                    items_to_delete.push(folder);
                }

                this.options.chain_call_control.total_number = items_total;
                // call the recursive function to call ajax one after each other (request FIFO queue)
                this.chainCallDeletingItems(items_to_delete);
            }
        },

        showLocInfo: function showLocInfo() {
            var _this14 = this;

            var library = null;
            if (Galaxy.libraries.libraryListView !== null) {
                library = Galaxy.libraries.libraryListView.collection.get(this.options.parent_library_id);
                this.showLocInfoModal(library);
            } else {
                library = new _libraryModel2.default.Library({
                    id: this.options.parent_library_id
                });
                library.fetch({
                    success: function success() {
                        _this14.showLocInfoModal(library);
                    },
                    error: function error(model, response) {
                        if (typeof response.responseJSON !== "undefined") {
                            _toastr2.default.error(response.responseJSON.err_msg);
                        } else {
                            _toastr2.default.error("An error occurred.");
                        }
                    }
                });
            }
        },

        showLocInfoModal: function showLocInfoModal(library) {
            var template = this.templateLocInfoInModal();
            this.modal = Galaxy.modal;
            this.modal.show({
                closing_events: true,
                title: (0, _localization2.default)("Location Details"),
                body: template({
                    library: library,
                    options: this.options
                }),
                buttons: {
                    Close: function Close() {
                        Galaxy.modal.hide();
                    }
                }
            });
        },

        showImportModal: function showImportModal(options) {
            switch (options.source) {
                case "history":
                    this.addFilesFromHistoryModal();
                    break;
                case "importdir":
                    this.importFilesFromGalaxyFolderModal({
                        source: "importdir"
                    });
                    break;
                case "path":
                    this.importFilesFromPathModal();
                    break;
                case "userdir":
                    this.importFilesFromGalaxyFolderModal({
                        source: "userdir"
                    });
                    break;
                default:
                    Galaxy.libraries.library_router.back();
                    _toastr2.default.error("Invalid import source.");
                    break;
            }
        },

        /**
         * Show user the prompt to change the number of items shown on page.
         */
        showPageSizePrompt: function showPageSizePrompt(e) {
            e.preventDefault();
            var folder_page_size = prompt("How many items per page do you want to see?", Galaxy.libraries.preferences.get("folder_page_size"));
            if (folder_page_size != null && folder_page_size == parseInt(folder_page_size)) {
                Galaxy.libraries.preferences.set({
                    folder_page_size: parseInt(folder_page_size)
                });
                Galaxy.libraries.folderListView.render({
                    id: this.options.id,
                    show_page: 1
                });
            }
        },

        findCheckedRows: function findCheckedRows() {
            return $("#folder_list_body").find(":checked");
        },

        findCheckedItems: function findCheckedItems() {
            var folder_ids = [];
            var dataset_ids = [];
            this.findCheckedRows().each(function() {
                var row_id = $(this).closest("tr").data("id");
                if (row_id.substring(0, 1) == "F") {
                    folder_ids.push(row_id);
                } else {
                    dataset_ids.push(row_id);
                }
            });
            return {
                folder_ids: folder_ids,
                dataset_ids: dataset_ids
            };
        },

        showCollectionSelect: function showCollectionSelect(e) {
            var _this15 = this;

            e.preventDefault();
            var checked_items = this.findCheckedItems();
            var template = this.templateCollectionSelectModal();
            this.modal = Galaxy.modal;
            this.modal.show({
                closing_events: true,
                title: "Create History Collection from Datasets",
                body: template({
                    selected_datasets: checked_items.dataset_ids.length
                }),
                buttons: {
                    Continue: function Continue() {
                        _this15.showColectionBuilder(checked_items.dataset_ids);
                    },
                    Close: function Close() {
                        Galaxy.modal.hide();
                    }
                }
            });
            this.prepareCollectionTypeSelect();
            this.prepareHistoryTypeSelect();
        },

        prepareCollectionTypeSelect: function prepareCollectionTypeSelect() {
            var _this16 = this;

            this.collectionType = "list";
            this.select_collection_type = new _uiSelect2.default.View({
                css: "library-collection-type-select",
                container: this.modal.$el.find(".library-collection-type-select"),
                data: [{
                    id: "list",
                    text: "List"
                }, {
                    id: "paired",
                    text: "Paired"
                }, {
                    id: "list:paired",
                    text: "List of Pairs"
                }],
                value: "list",
                onchange: function onchange(collectionType) {
                    _this16.updateCollectionType(collectionType);
                }
            });
        },

        prepareHistoryTypeSelect: function prepareHistoryTypeSelect() {
            var _this17 = this;

            var promise = this.fetchUserHistories();
            promise.done(function() {
                var history_options = [];
                for (var i = _this17.histories.length - 1; i >= 0; i--) {
                    history_options.unshift({
                        id: _this17.histories.models[i].id,
                        text: _this17.histories.models[i].get("name")
                    });
                }
                _this17.select_collection_history = new _uiSelect2.default.View({
                    css: "library-collection-history-select",
                    container: _this17.modal.$el.find(".library-collection-history-select"),
                    data: history_options,
                    value: history_options[0].id
                });
            });
        },

        /** Update collection type */
        updateCollectionType: function updateCollectionType(collectionType) {
            this.collectionType = collectionType;
        },

        showColectionBuilder: function showColectionBuilder(checked_items) {
            var _this18 = this;

            var collection_elements = [];
            var elements_source = this.modal.$('input[type="radio"]:checked').val();
            if (elements_source === "selection") {
                for (var i = checked_items.length - 1; i >= 0; i--) {
                    var collection_item = {};
                    var dataset = Galaxy.libraries.folderListView.folder_container.get("folder").get(checked_items[i]);
                    collection_item.id = checked_items[i];
                    collection_item.name = dataset.get("name");
                    collection_item.deleted = dataset.get("deleted");
                    collection_item.state = dataset.get("state");
                    collection_elements.push(collection_item);
                }
            } else if (elements_source === "folder") {
                collection_elements = new Backbone.Collection(Galaxy.libraries.folderListView.folder_container.get("folder").where({
                    type: "file"
                })).toJSON();
            }
            var new_history_name = this.modal.$("input[name=history_name]").val();
            if (new_history_name !== "") {
                this.createNewHistory(new_history_name).done(function(new_history) {
                    _toastr2.default.success("History created");
                    _this18.collectionImport(collection_elements, new_history.id, new_history.name);
                }).fail(function(xhr, status, error) {
                    _toastr2.default.error("An error occurred.");
                });
            } else {
                var selected_history_id = this.select_collection_history.value();
                var selected_history_name = this.select_collection_history.text();
                this.collectionImport(collection_elements, selected_history_id, selected_history_name);
            }
        },

        collectionImport: function collectionImport(collection_elements, history_id, history_name) {
            var _this19 = this;

            var modal_title = "Creating Collection in " + history_name;
            var creator_class = void 0;
            var creationFn = void 0;
            if (this.collectionType === "list") {
                creator_class = _listCollectionCreator2.default.ListCollectionCreator;
                creationFn = function creationFn(elements, name, hideSourceItems) {
                    elements = elements.map(function(element) {
                        return {
                            id: element.id,
                            name: element.name,
                            src: "ldda"
                        };
                    });
                    return _this19.createHDCA(elements, _this19.collectionType, name, hideSourceItems, history_id);
                };
                _listCollectionCreator2.default.collectionCreatorModal(collection_elements, {
                    creationFn: creationFn,
                    title: modal_title,
                    defaultHideSourceItems: true
                }, creator_class);
            } else if (this.collectionType === "paired") {
                creator_class = _pairCollectionCreator2.default.PairCollectionCreator;
                creationFn = function creationFn(elements, name, hideSourceItems) {
                    elements = [{
                        name: "forward",
                        src: "ldda",
                        id: elements[0].id
                    }, {
                        name: "reverse",
                        src: "ldda",
                        id: elements[1].id
                    }];
                    return _this19.createHDCA(elements, _this19.collectionType, name, hideSourceItems, history_id);
                };
                _listCollectionCreator2.default.collectionCreatorModal(collection_elements, {
                    creationFn: creationFn,
                    title: modal_title,
                    defaultHideSourceItems: true
                }, creator_class);
            } else if (this.collectionType === "list:paired") {
                var elements = collection_elements.map(function(element) {
                    return {
                        id: element.id,
                        name: element.name,
                        src: "ldda"
                    };
                });
                _listOfPairsCollectionCreator2.default.pairedCollectionCreatorModal(elements, {
                    historyId: history_id,
                    title: modal_title,
                    defaultHideSourceItems: true
                });
            }
        },

        createHDCA: function createHDCA(elementIdentifiers, collectionType, name, hideSourceItems, history_id, options) {
            var hdca = new _hdcaModel2.default.HistoryDatasetCollection({
                history_content_type: "dataset_collection",
                collection_type: collectionType,
                history_id: history_id,
                name: name,
                hide_source_items: hideSourceItems || false,
                element_identifiers: elementIdentifiers
            });
            return hdca.save(options);
        },

        templateToolBar: function templateToolBar() {
            return _.template([
                // container start
                '<div class="library_style_container">',
                // toolbar start
                '<div id="library_toolbar">', '<form class="form-inline" role="form">', "<span><strong>DATA LIBRARIES</strong></span>",
                // paginator will append here
                '<span class="library-paginator folder-paginator"></span>',
                // include deleted checkbox
                '<div class="checkbox toolbar-item logged-dataset-manipulation" style="height: 20px; display:none;">', "<label>", '<input type="checkbox" class="include-deleted-datasets-chk">include deleted</input>', "</label>", "</div>",
                // create new folder button
                '<button style="display:none;" data-toggle="tooltip" data-placement="top" title="Create New Folder" class="btn btn-default primary-button toolbtn-create-folder add-library-items add-library-items-folder toolbar-item" type="button">', '<span class="fa fa-plus"></span><span class="fa fa-folder"></span> Create Folder ', "</button>",
                // add datasets button
                "<% if(mutiple_add_dataset_options) { %>", '<div class="btn-group add-library-items add-library-items-datasets toolbar-item" style="display:none;">', '<button title="Add Datasets to Current Folder" id="" type="button" class="primary-button dropdown-toggle" data-toggle="dropdown">', '<span class="fa fa-plus"></span><span class="fa fa-file"></span> Add Datasets <span class="caret"></span>', "</button>", '<ul class="dropdown-menu" role="menu">', '<li><a href="#folders/<%= id %>/import/history"> from History</a></li>', "<% if(Galaxy.config.user_library_import_dir !== null) { %>", '<li><a href="#folders/<%= id %>/import/userdir"> from User Directory</a></li>', "<% } %>", "<% if(Galaxy.config.allow_library_path_paste) { %>", '<li class="divider"></li>', '<li class="dropdown-header">Admins only</li>', "<% if(Galaxy.config.library_import_dir !== null) { %>", '<li><a href="#folders/<%= id %>/import/importdir">from Import Directory</a></li>', "<% } %>", "<% if(Galaxy.config.allow_library_path_paste) { %>", '<li><a href="#folders/<%= id %>/import/path">from Path</a></li>', "<% } %>", "<% } %>", "</ul>", "</div>", "<% } else { %>", '<a data-placement="top" title="Add Datasets to Current Folder" style="display:none;" class="btn btn-default add-library-items add-library-items-datasets" href="#folders/<%= id %>/import/history" role="button">', '<span class="fa fa-plus"></span><span class="fa fa-file"></span>', "</a>", "<% } %>",
                // import to history button
                '<div class="btn-group toolbar-item">', '<button title="Import to history" type="button" class="primary-button dropdown-toggle add-to-history" data-toggle="dropdown">', '<span class="fa fa-book"></span> To History <span class="caret"></span>', "</button>", '<ul class="dropdown-menu" role="menu">', '<li><a href="" class="toolbtn-bulk-import add-to-history-datasets">as Datasets</a></li>', '<li><a href="" class="toolbtn-collection-import add-to-history-collection">as a Collection</a></li>', "</ul>", "</div>",
                // download button
                '<div class="btn-group dataset-manipulation toolbar-item" style="display:none; ">', '<button title="Download items as archive" type="button" class="primary-button dropdown-toggle" data-toggle="dropdown">', '<span class="fa fa-save"></span> Download <span class="caret"></span>', "</button>", '<ul class="dropdown-menu" role="menu">', '<li><a href="#/folders/<%= id %>/download/tgz">.tar.gz</a></li>', '<li><a href="#/folders/<%= id %>/download/tbz">.tar.bz</a></li>', '<li><a href="#/folders/<%= id %>/download/zip">.zip</a></li>', "</ul>", "</div>",
                // delete button
                '<button data-toggle="tooltip" data-placement="top" title="Mark items deleted" class="primary-button toolbtn-bulk-delete logged-dataset-manipulation toolbar-item" style="display:none;" type="button">', '<span class="fa fa-trash"></span> Delete', "</button>",
                // help button
                '<span class="right-float" data-toggle="tooltip" data-placement="top" title="See this screen annotated">', '<a href="https://galaxyproject.org/data-libraries/screen/folder-contents/" target="_blank">', '<button class="primary-button" type="button">', '<span class="fa fa-question-circle"></span>', "&nbsp;Help", "</button>", "</a>", "</span>",
                // location button
                '<span class="right-float" data-toggle="tooltip" data-placement="top" title="Show location details">', '<button data-id="<%- id %>" class="primary-button toolbtn-show-locinfo toolbar-item" type="button">', '<span class="fa fa-info-circle"></span>', "&nbsp;Details", "</button>", "</span>",
                // toolbar end
                "</div>", "</form>",
                // folder contents will append here
                '<div id="folder_items_element" />',
                // paginator will append here
                '<div class="folder-paginator paginator-bottom" />',
                // container end
                "</div>"
            ].join(""));
        },

        templateLocInfoInModal: function templateLocInfoInModal() {
            return _.template(["<div>", '<table class="grid table table-condensed">', "<thead>", '<th style="width: 25%;">library</th>', "<th></th>", "</thead>", "<tbody>", "<tr>", "<td>name</td>", '<td><%- library.get("name") %></td>', "</tr>", '<% if(library.get("description") !== "") { %>', "<tr>", "<td>description</td>", '<td><%- library.get("description") %></td>', "</tr>", "<% } %>", '<% if(library.get("synopsis") !== "") { %>', "<tr>", "<td>synopsis</td>", '<td><%- library.get("synopsis") %></td>', "</tr>", "<% } %>", '<% if(library.get("create_time_pretty") !== "") { %>', "<tr>", "<td>created</td>", '<td><span title="<%- library.get("create_time") %>"><%- library.get("create_time_pretty") %></span></td>', "</tr>", "<% } %>", "<tr>", "<td>id</td>", '<td><%- library.get("id") %></td>', "</tr>", "</tbody>", "</table>", '<table class="grid table table-condensed">', "<thead>", '<th style="width: 25%;">folder</th>', "<th></th>", "</thead>", "<tbody>", "<tr>", "<td>name</td>", "<td><%- options.folder_name %></td>", "</tr>", '<% if(options.folder_description !== "") { %>', "<tr>", "<td>description</td>", "<td><%- options.folder_description %></td>", "</tr>", "<% } %>", "<tr>", "<td>id</td>", "<td><%- options.id %></td>", "</tr>", "</tbody>", "</table>", "</div>"].join(""));
        },

        templateNewFolderInModal: function templateNewFolderInModal() {
            return _.template(['<div id="new_folder_modal">', "<form>", '<input type="text" name="Name" value="" placeholder="Name" autofocus>', '<input type="text" name="Description" value="" placeholder="Description">', "</form>", "</div>"].join(""));
        },

        templateImportIntoHistoryModal: function templateImportIntoHistoryModal() {
            return _.template(["<div>", '<div class="library-modal-item">', "Select history: ", '<select name="import_to_history" style="width:50%; margin-bottom: 1em; " autofocus>', "<% _.each(histories, function(history) { %>", '<option value="<%= _.escape(history.get("id")) %>"><%= _.escape(history.get("name")) %></option>', "<% }); %>", "</select>", "</div>", '<div class="library-modal-item">', "or create new: ", '<input type="text" name="history_name" value="" placeholder="name of the new history" style="width:50%;" />', "</div>", "</div>"].join(""));
        },

        templateImportIntoHistoryProgressBar: function templateImportIntoHistoryProgressBar() {
            return _.template(['<div class="import_text">', "Importing selected items to history <b><%= _.escape(history_name) %></b>", "</div>", '<div class="progress">', '<div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 00%;">', '<span class="completion_span">0% Complete</span>', "</div>", "</div>"].join(""));
        },

        templateAddingDatasetsProgressBar: function templateAddingDatasetsProgressBar() {
            return _.template(['<div class="import_text">', "Adding selected datasets to library folder <b><%= _.escape(folder_name) %></b>", "</div>", '<div class="progress">', '<div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 00%;">', '<span class="completion_span">0% Complete</span>', "</div>", "</div>"].join(""));
        },

        templateDeletingItemsProgressBar: function templateDeletingItemsProgressBar() {
            return _.template(['<div class="import_text">', "</div>", '<div class="progress">', '<div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 00%;">', '<span class="completion_span">0% Complete</span>', "</div>", "</div>"].join(""));
        },

        templateBrowserModal: function templateBrowserModal() {
            return _.template(['<div id="file_browser_modal">', '<div class="alert alert-info jstree-files-message">All files you select will be imported into the current folder ignoring their folder structure.</div>', '<div class="alert alert-info jstree-folders-message" style="display:none;">All files within the selected folders and their subfolders will be imported into the current folder.</div>', '<div style="margin-bottom:1em;">', '<label title="Switch to selecting files" class="radio-inline import-type-switch">', '<input type="radio" name="jstree-radio" value="jstree-disable-folders" checked="checked"> Choose Files', "</label>", '<label title="Switch to selecting folders" class="radio-inline import-type-switch">', '<input type="radio" name="jstree-radio" value="jstree-disable-files"> Choose Folders', "</label>", "</div>", '<div style="margin-bottom:1em;">', '<label class="checkbox-inline jstree-preserve-structure" style="display:none;">', '<input class="preserve-checkbox" type="checkbox" value="preserve_directory_structure">', "Preserve directory structure", "</label>", '<label class="checkbox-inline">', '<input class="link-checkbox" type="checkbox" value="link_files">', "Link files instead of copying", "</label>", '<label class="checkbox-inline">', '<input class="posix-checkbox" type="checkbox" value="to_posix_lines" checked="checked">', "Convert line endings to POSIX", "</label>", '<label class="checkbox-inline">', '<input class="spacetab-checkbox" type="checkbox" value="space_to_tab">', "Convert spaces to tabs", "</label>", "</div>", '<button title="Select all files" type="button" class="button primary-button libimport-select-all">', "Select all", "</button>", '<button title="Select no files" type="button" class="button primary-button libimport-select-none">', "Unselect all", "</button>", "<hr />",
                // append jstree object here
                '<div id="jstree_browser">', "</div>", "<hr />", "<p>You can set extension type and genome for all imported datasets at once:</p>", "<div>", 'Type: <span id="library_extension_select" class="library-extension-select" />', 'Genome: <span id="library_genome_select" class="library-genome-select" />', "</div>", "<br>", "<div>", '<label class="checkbox-inline tag-files">', "Tag datasets based on file names", '<input class="tag-files" type="checkbox" value="tag_using_filenames">', "</label>", "</div>", "</div>"
            ].join(""));
        },

        templateImportPathModal: function templateImportPathModal() {
            return _.template(['<div id="file_browser_modal">', '<div class="alert alert-info jstree-folders-message">All files within the given folders and their subfolders will be imported into the current folder.</div>', '<div style="margin-bottom: 0.5em;">', '<label class="checkbox-inline">', '<input class="preserve-checkbox" type="checkbox" value="preserve_directory_structure">', "Preserve directory structure", "</label>", '<label class="checkbox-inline">', '<input class="link-checkbox" type="checkbox" value="link_files">', "Link files instead of copying", "</label>", "<br>", '<label class="checkbox-inline">', '<input class="posix-checkbox" type="checkbox" value="to_posix_lines" checked="checked">', "Convert line endings to POSIX", "</label>", '<label class="checkbox-inline">', '<input class="spacetab-checkbox" type="checkbox" value="space_to_tab">', "Convert spaces to tabs", "</label>", "</div>", '<textarea id="import_paths" class="form-control" rows="5" placeholder="Absolute paths (or paths relative to Galaxy root) separated by newline" autofocus></textarea>', "<hr />", "<p>You can set extension type and genome for all imported datasets at once:</p>", "<div>", 'Type: <span id="library_extension_select" class="library-extension-select" />', 'Genome: <span id="library_genome_select" class="library-genome-select" />', "</div>", "<div>", '<label class="checkbox-inline tag-files">', "Tag datasets based on file names", '<input class="tag-files" type="checkbox" value="tag_using_filenames">', "</label>", "</div>", "</div>"].join(""));
        },

        templateAddFilesFromHistory: function templateAddFilesFromHistory() {
            return _.template(['<div id="add_files_modal">', "<div>", "1.&nbsp;Select history:&nbsp;", '<select id="dataset_add_bulk" name="dataset_add_bulk" style="width:66%; "> ', "<% _.each(histories, function(history) { %>", //history select box
                '<option value="<%= _.escape(history.get("id")) %>"><%= _.escape(history.get("name")) %></option>', "<% }); %>", "</select>", "</div>", "<br/>", '<div class="library_selected_history_content">', "</div>", "</div>"
            ].join(""));
        },

        templateHistoryContents: function templateHistoryContents() {
            return _.template(["<p>2.&nbsp;Choose the datasets to import:</p>", "<div>", '<button title="Select all datasets" type="button" class="button primary-button history-import-select-all">', "Select all", "</button>", '<button title="Select all datasets" type="button" class="button primary-button history-import-unselect-all">', "Unselect all", "</button>", "</div>", "<br>", "<ul>", "<% _.each(history_contents, function(history_item) { %>", '<% if (history_item.get("deleted") != true ) { %>', '<% var item_name = history_item.get("name") %>', '<% if (history_item.get("type") === "collection") { %>', '<% var collection_type = history_item.get("collection_type") %>', '<% if (collection_type === "list") { %>', '<li data-id="<%= _.escape(history_item.get("id")) %>" data-name="<%= _.escape(history_item.get("type")) %>">', "<label>", '<label title="<%= _.escape(item_name) %>">', '<input style="margin: 0;" type="checkbox"> <%= _.escape(history_item.get("hid")) %>: ', '<%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %> (Dataset Collection)', "</label>", "</li>", "<% } else { %>", '<li><input style="margin: 0;" type="checkbox" onclick="return false;" disabled="disabled">', '<span title="You can convert this collection into a collection of type list using the Collection Tools">', '<%= _.escape(history_item.get("hid")) %>: ', '<%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %> (Dataset Collection of type <%= _.escape(collection_type) %> not supported.)', "</span>", "</li>", "<% } %>", '<% } else if (history_item.get("visible") === true && history_item.get("state") === "ok") { %>', '<li data-id="<%= _.escape(history_item.get("id")) %>" data-name="<%= _.escape(history_item.get("type")) %>">', '<label title="<%= _.escape(item_name) %>">', '<input style="margin: 0;" type="checkbox"> <%= _.escape(history_item.get("hid")) %>: ', '<%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %>', "</label>", "</li>", "<% } %>", "<% } %>", "<% }); %>", "</ul>"].join(""));
        },

        templatePaginator: function templatePaginator() {
            return _.template(['<ul class="pagination pagination-sm">', "<% if ( ( show_page - 1 ) > 0 ) { %>", "<% if ( ( show_page - 1 ) > page_count ) { %>", // we are on higher page than total page count
                '<li><a href="#folders/<%= id %>/page/1"><span class="fa fa-angle-double-left"></span></a></li>', '<li class="disabled"><a href="#folders/<%= id %>/page/<% print( show_page ) %>"><% print( show_page - 1 ) %></a></li>', "<% } else { %>", '<li><a href="#folders/<%= id %>/page/1"><span class="fa fa-angle-double-left"></span></a></li>', '<li><a href="#folders/<%= id %>/page/<% print( show_page - 1 ) %>"><% print( show_page - 1 ) %></a></li>', "<% } %>", "<% } else { %>", // we are on the first page
                '<li class="disabled"><a href="#folders/<%= id %>/page/1"><span class="fa fa-angle-double-left"></span></a></li>', '<li class="disabled"><a href="#folders/<%= id %>/page/<% print( show_page ) %>"><% print( show_page - 1 ) %></a></li>', "<% } %>", '<li class="active">', '<a href="#folders/<%= id %>/page/<% print( show_page ) %>"><% print( show_page ) %></a>', "</li>", "<% if ( ( show_page ) < page_count ) { %>", '<li><a href="#folders/<%= id %>/page/<% print( show_page + 1 ) %>"><% print( show_page + 1 ) %></a></li>', '<li><a href="#folders/<%= id %>/page/<% print( page_count ) %>"><span class="fa fa-angle-double-right"></span></a></li>', "<% } else { %>", '<li class="disabled"><a href="#folders/<%= id %>/page/<% print( show_page  ) %>"><% print( show_page + 1 ) %></a></li>', '<li class="disabled"><a href="#folders/<%= id %>/page/<% print( page_count ) %>"><span class="fa fa-angle-double-right"></span></a></li>', "<% } %>", "</ul>", "<span>", ' <%- items_shown %> items shown <a href="" data-toggle="tooltip" data-placement="top" title="currently <%- folder_page_size %> per page" class="page-size-prompt">(change)</a>', "</span>", "<span>", " <%- total_items_count %> total", "</span>"
            ].join(""));
        },

        templateCollectionSelectModal: function templateCollectionSelectModal() {
            return _.template(["<div>",
                // elements selection
                '<div class="library-modal-item">', "<h4>Which datasets?</h4>", '<form class="form-inline">', '<label class="radio-inline">', '<input type="radio" name="radio_elements" id="selection_radio" value="selection" <% if (!selected_datasets) { %> disabled <% } else { %> checked <% } %> > current selection', "<% if (selected_datasets) { %>", " (<%- selected_datasets %>)", "<% } %>", "</label>", '<label class="radio-inline">', '<input type="radio" name="radio_elements" id="folder_radio" value="folder" <% if (!selected_datasets) { %> checked <% } %> > all datasets in current folder', "</label>", "</form>", "</div>",
                // type selection
                '<div class="library-modal-item">', "<h4>Collection type</h4>", '<span class="library-collection-type-select"/>', "<h5>Which type to choose?</h5>", "<ul>", "<li>", "List: Generic collection which groups any number of datasets into a set; similar to file system folder.", "</li>", "<li>", "Paired: Simple collection containing exactly two sequence datasets; one reverse and the other forward.", "</li>", "<li>", "List of Pairs: Advanced collection containing any number of Pairs; imagine as Pair-type collections inside of a List-type collection.", "</li>", "</ul>", "</div>",
                // history selection/creation
                '<div class="library-modal-item">', "<h4>Select history</h4>", '<span class="library-collection-history-select"/>', " or create new: ", '<input type="text" name="history_name" value="" placeholder="name of the new history" />', "</div>", "</div>"
            ].join(""));
        }
    });

    exports.default = {
        FolderToolbarView: FolderToolbarView
    };
});
//# sourceMappingURL=../../../maps/mvc/library/library-foldertoolbar-view.js.map
