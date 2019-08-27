import $ from "jquery";
import _ from "underscore";
import Backbone from "backbone";
import { getAppRoot } from "onload/loadConfig";
import { getGalaxyInstance } from "app";
import _l from "utils/localization";
import mod_utils from "utils/utils";
import { Toast } from "ui/toast";
import mod_library_model from "mvc/library/library-model";
import mod_select from "mvc/ui/ui-select";
import LIST_CREATOR from "mvc/collection/list-collection-creator";
import PAIR_CREATOR from "mvc/collection/pair-collection-creator";
import PAIRED_CREATOR from "mvc/collection/list-of-pairs-collection-creator";
import HDCA_MODEL from "mvc/history/hdca-model";
import "libs/jquery/jstree";

var FolderToolbarView = Backbone.View.extend({
    el: "#center",

    events: {
        "click .toolbtn-create-folder": "createFolderInline",
        "click .toolbtn-bulk-import": "importToHistoryModal",
        "click .include-deleted-datasets-chk": "checkIncludeDeleted",
        "click .toolbtn-bulk-delete": "deleteSelectedItems",
        "click .toolbtn-show-locinfo": "showLocInfo",
        "keydown .page_size": "changePageSize",
        "blur .page_size": "changePageSize",
        "click .toolbtn-collection-import": "showCollectionSelect",
        "keyup .folder-search-input": "searchFolder"
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
        description:
            "This system will try to detect the file type automatically." +
            " If your file is not detected properly as one of the known formats," +
            " it most likely means that it has some format problems (e.g., different" +
            " number of columns on different rows). You can still coerce the system" +
            " to set your data to the format you think it should be." +
            " You can also upload compressed files, which will automatically be decompressed."
    },

    // genomes
    list_genomes: [],

    initialize: function(options) {
        this.options = _.defaults(options || {}, this.defaults);
        this.fetchExtAndGenomes();
        this.render();
    },

    render: function(options) {
        this.options = _.extend(this.options, options);
        const Galaxy = getGalaxyInstance();
        var toolbar_template = this.templateToolBar();
        var template_defaults = {
            id: this.options.id,
            is_admin: false,
            is_anonym: true,
            multiple_add_dataset_options: false,
            Galaxy: Galaxy,
            folder_page_size: Galaxy.libraries.preferences.get("folder_page_size")
        };
        if (Galaxy.user) {
            template_defaults.is_admin = Galaxy.user.isAdmin();
            template_defaults.is_anonym = Galaxy.user.isAnonymous();
            if (
                Galaxy.config.user_library_import_dir !== null ||
                Galaxy.config.allow_library_path_paste !== false ||
                Galaxy.config.library_import_dir !== null
            ) {
                template_defaults.multiple_add_dataset_options = true;
            }
        }
        this.$el.html(toolbar_template(template_defaults));
    },

    /**
     * Called from FolderListView when needed.
     * @param  {object} options common options
     */
    renderPaginator: function(options) {
        this.options = _.extend(this.options, options);
        const Galaxy = getGalaxyInstance();
        var paginator_template = this.templatePaginator();
        var paginator_text_template = this.templatePaginatorText();
        $("body")
            .find(".folder-paginator > .paginator")
            .html(
                paginator_template({
                    id: this.options.id,
                    show_page: parseInt(this.options.show_page),
                    page_count: parseInt(this.options.page_count),
                    total_items_count: this.options.total_items_count,
                    items_shown: this.options.items_shown,
                    folder_page_size: Galaxy.libraries.preferences.get("folder_page_size")
                })
            );
        $("body")
            .find(".folder-paginator > .paginator-text")
            .html(
                paginator_text_template({
                    id: this.options.id,
                    show_page: parseInt(this.options.show_page),
                    page_count: parseInt(this.options.page_count),
                    total_items_count: this.options.total_items_count,
                    items_shown: this.options.items_shown,
                    folder_page_size: Galaxy.libraries.preferences.get("folder_page_size")
                })
            );
    },

    configureElements: function(options) {
        this.options = _.extend(this.options, options);
        const Galaxy = getGalaxyInstance();

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
        this.$el.find('[data-toggle="tooltip"]').tooltip({ trigger: "hover" });
    },

    createFolderInline: function() {
        const Galaxy = getGalaxyInstance();
        Galaxy.libraries.folderListView.createFolderInline();
    },

    importToHistoryModal: function(e) {
        e.preventDefault();
        const Galaxy = getGalaxyInstance();
        var $checkedValues = this.findCheckedRows();
        var template = this.templateImportIntoHistoryModal();
        if ($checkedValues.length === 0) {
            Toast.info("You must select some datasets first.");
        } else {
            var promise = this.fetchUserHistories();
            promise
                .done(() => {
                    this.modal = Galaxy.modal;
                    this.modal.show({
                        closing_events: true,
                        title: _l("Import into History"),
                        body: template({
                            histories: this.histories.models
                        }),
                        buttons: {
                            Import: () => {
                                this.importAllIntoHistory();
                            },
                            Close: () => {
                                Galaxy.modal.hide();
                            }
                        }
                    });
                })
                .fail((model, response) => {
                    if (typeof response.responseJSON !== "undefined") {
                        Toast.error(response.responseJSON.err_msg);
                    } else {
                        Toast.error("An error occurred.");
                    }
                });
        }
    },

    /**
     * This function returns a promise
     */
    fetchUserHistories: function() {
        this.histories = new mod_library_model.GalaxyHistories();
        return this.histories.fetch();
    },

    importAllIntoHistory: function() {
        this.modal.disableButton("Import");
        var new_history_name = this.modal.$("input[name=history_name]").val();
        if (new_history_name !== "") {
            this.createNewHistory(new_history_name)
                .done(new_history => {
                    this.processImportToHistory(new_history.id, new_history.name);
                })
                .fail((xhr, status, error) => {
                    Toast.error("An error occurred.");
                })
                .always(() => {
                    this.modal.enableButton("Import");
                });
        } else {
            var history_id = $("select[name=import_to_history] option:selected").val();
            var history_name = $("select[name=import_to_history] option:selected").text();
            this.processImportToHistory(history_id, history_name);
            this.modal.enableButton("Import");
        }
    },

    /**
     * This function returns a promise
     */
    createNewHistory: function(new_history_name) {
        return $.post(`${getAppRoot()}api/histories`, { name: new_history_name });
    },

    processImportToHistory: function(history_id, history_name) {
        var checked_items = this.findCheckedItems();
        var items_to_import = [];
        // prepare the dataset objects to be imported
        for (let i = checked_items.dataset_ids.length - 1; i >= 0; i--) {
            const library_dataset_id = checked_items.dataset_ids[i];
            const historyItem = new mod_library_model.HistoryItem();
            historyItem.url = `${historyItem.urlRoot + history_id}/contents`;
            historyItem.content = library_dataset_id;
            historyItem.source = "library";
            items_to_import.push(historyItem);
        }
        // prepare the folder objects to be imported
        for (let i = checked_items.folder_ids.length - 1; i >= 0; i--) {
            const library_folder_id = checked_items.folder_ids[i];
            const historyItem = new mod_library_model.HistoryItem();
            historyItem.url = `${historyItem.urlRoot + history_id}/contents`;
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
        $.getJSON(`${getAppRoot()}history/set_as_current?id=${history_id}`);
        this.chainCallImportingIntoHistory(items_to_import, history_name);
    },

    /**
     * Update progress bar in modal.
     */
    updateProgress: function() {
        this.progress += this.progressStep;
        $(".progress-bar-import").width(`${Math.round(this.progress)}%`);
        var txt_representation = `${Math.round(this.progress)}% Complete`;
        $(".completion_span").text(txt_representation);
    },

    /**
     * Download selected datasets. Called from the router.
     * @param  {str} format    requested archive format
     */
    download: function(format) {
        var checked_items = this.findCheckedItems();
        var url = `${getAppRoot()}api/libraries/datasets/download/${format}`;
        var data = { ld_ids: checked_items.dataset_ids, folder_ids: checked_items.folder_ids };
        this.processDownload(url, data, "get");
    },

    /**
     * Create hidden form and submit it through POST
     * to initialize the download.
     * @param  {str} url    url to call
     * @param  {obj} data   data to include in the request
     * @param  {str} method method of the request
     */
    processDownload: function(url, data, method) {
        if (url && data) {
            // data can be string of parameters or array/object
            data = typeof data === "string" ? data : $.param(data);
            // split params into form inputs
            var inputs = "";
            $.each(data.split("&"), function() {
                var pair = this.split("=");
                inputs += `<input type="hidden" name="${pair[0]}" value="${pair[1]}" />`;
            });
            // send request
            $(`<form action="${url}" method="${method || "post"}">${inputs}</form>`)
                .appendTo("body")
                .submit()
                .remove();
            Toast.info("Your download will begin soon.");
        } else {
            Toast.error("An error occurred.");
        }
    },

    addFilesFromHistoryModal: function() {
        const Galaxy = getGalaxyInstance();
        this.histories = new mod_library_model.GalaxyHistories();
        this.histories
            .fetch()
            .done(() => {
                this.modal = Galaxy.modal;
                var template_modal = this.templateAddFilesFromHistory();
                this.modal.show({
                    closing_events: true,
                    title: _l("Adding datasets from your history"),
                    body: template_modal({
                        histories: this.histories.models
                    }),
                    buttons: {
                        Add: () => {
                            this.addAllDatasetsFromHistory();
                        },
                        Close: () => {
                            Galaxy.modal.hide();
                        }
                    },
                    closing_callback: () => {
                        Galaxy.libraries.library_router.navigate(`folders/${this.id}`, { trigger: true });
                    }
                });
                this.fetchAndDisplayHistoryContents(this.histories.models[0].id);
                $("#dataset_add_bulk").change(event => {
                    this.fetchAndDisplayHistoryContents(event.target.value);
                });
            })
            .fail((model, response) => {
                if (typeof response.responseJSON !== "undefined") {
                    Toast.error(response.responseJSON.err_msg);
                } else {
                    Toast.error("An error occurred.");
                }
            });
    },

    /**
     * Create modal for importing from Galaxy path.
     */
    importFilesFromPathModal: function() {
        const Galaxy = getGalaxyInstance();
        this.modal = Galaxy.modal;
        var template_modal = this.templateImportPathModal();
        this.modal.show({
            closing_events: true,
            title: _l("Please enter paths to import"),
            body: template_modal({}),
            buttons: {
                Import: () => {
                    this.importFromPathsClicked(this);
                },
                Close: () => {
                    Galaxy.modal.hide();
                }
            },
            closing_callback: () => {
                //  TODO: should not trigger routes outside of the router
                Galaxy.libraries.library_router.navigate(`folders/${this.id}`, {
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
    fetchExtAndGenomes: function() {
        mod_utils.get({
            url: `${getAppRoot()}api/datatypes?extension_only=False`,
            success: datatypes => {
                this.list_extensions = [];
                for (const key in datatypes) {
                    this.list_extensions.push({
                        id: datatypes[key].extension,
                        text: datatypes[key].extension,
                        description: datatypes[key].description,
                        description_url: datatypes[key].description_url
                    });
                }
                this.list_extensions.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
                this.list_extensions.unshift(this.auto);
            },
            cache: true
        });
        mod_utils.get({
            url: `${getAppRoot()}api/genomes`,
            success: genomes => {
                this.list_genomes = [];
                for (const key in genomes) {
                    this.list_genomes.push({
                        id: genomes[key][1],
                        text: genomes[key][0]
                    });
                }
                this.list_genomes.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
            },
            cache: true
        });
    },

    renderSelectBoxes: function() {
        const Galaxy = getGalaxyInstance();
        // This won't work properly unlesss we already have the data fetched.
        // See this.fetchExtAndGenomes()
        this.select_genome = new mod_select.View({
            css: "library-genome-select",
            data: this.list_genomes,
            container: Galaxy.modal.$el.find("#library_genome_select"),
            value: "?"
        });
        this.select_extension = new mod_select.View({
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
    importFilesFromGalaxyFolderModal: function(options) {
        var template_modal = this.templateBrowserModal();
        const Galaxy = getGalaxyInstance();
        this.modal = Galaxy.modal;
        this.modal.show({
            closing_events: true,
            title: _l("Please select folders or files"),
            body: template_modal({}),
            buttons: {
                Import: () => {
                    this.importFromJstreePath(this, options);
                },
                Close: () => {
                    Galaxy.modal.hide();
                }
            },
            closing_callback: () => {
                //  TODO: should not trigger routes outside of the router
                Galaxy.libraries.library_router.navigate(`folders/${this.id}`, {
                    trigger: true
                });
            }
        });

        $(".libimport-select-all").bind("click", () => {
            $("#jstree_browser").jstree("check_all");
        });
        $(".libimport-select-none").bind("click", () => {
            $("#jstree_browser").jstree("uncheck_all");
        });

        this.renderSelectBoxes();
        options.disabled_jstree_element = "folders";
        this.renderJstree(options);

        $("input[type=radio]").change(event => {
            if (event.target.value === "jstree-disable-folders") {
                options.disabled_jstree_element = "folders";
                this.renderJstree(options);
                $(".jstree-folders-message").hide();
                $(".jstree-preserve-structure").hide();
                $(".jstree-files-message").show();
            } else if (event.target.value === "jstree-disable-files") {
                $(".jstree-files-message").hide();
                $(".jstree-folders-message").show();
                $(".jstree-preserve-structure").show();
                options.disabled_jstree_element = "files";
                this.renderJstree(options);
            }
        });
    },

    /**
     * Fetch the contents of user directory on Galaxy
     * and render jstree component based on received
     * data.
     * @param  {[type]} options [description]
     */
    renderJstree: function(options) {
        this.options = _.extend(this.options, options);
        var target = options.source || "userdir";
        var disabled_jstree_element = this.options.disabled_jstree_element;
        this.jstree = new mod_library_model.Jstree();
        this.jstree.url = `${this.jstree.urlRoot}?target=${target}&format=jstree&disable=${disabled_jstree_element}`;
        this.jstree.fetch({
            success: (model, response) => {
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
            error: (model, response) => {
                if (typeof response.responseJSON !== "undefined") {
                    if (response.responseJSON.err_code === 404001) {
                        Toast.warning(response.responseJSON.err_msg);
                    } else {
                        Toast.error(response.responseJSON.err_msg);
                    }
                } else {
                    Toast.error("An error occurred.");
                }
            }
        });
    },

    /**
     * Take the paths from the textarea, split it, create
     * a request queue and call a function that starts sending
     * one by one to be imported on the server.
     */
    importFromPathsClicked: function() {
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
            Toast.info("Please enter a path relative to Galaxy root.");
        } else {
            this.modal.disableButton("Import");
            paths = paths.split("\n");
            for (let i = paths.length - 1; i >= 0; i--) {
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
    initChainCallControl: function(options) {
        const Galaxy = getGalaxyInstance();
        var template;
        switch (options.action) {
            case "adding_datasets":
                template = this.templateAddingDatasetsProgressBar();
                this.modal.$el.find(".modal-body").html(
                    template({
                        folder_name: this.options.folder_name
                    })
                );
                break;
            case "deleting_datasets":
                template = this.templateDeletingItemsProgressBar();
                this.modal.$el.find(".modal-body").html(template());
                break;
            case "to_history":
                template = this.templateImportIntoHistoryProgressBar();
                this.modal.$el.find(".modal-body").html(template({ history_name: options.history_name }));
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
    importFromJstreePath: function(that, options) {
        var all_nodes = $("#jstree_browser")
            .jstree()
            .get_selected(true);
        // remove the disabled elements that could have been trigerred with the 'select all'
        var selected_nodes = _.filter(all_nodes, node => node.state.disabled == false);
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
            Toast.info("Please select some items first.");
        } else {
            this.modal.disableButton("Import");
            for (let i = selected_nodes.length - 1; i >= 0; i--) {
                if (selected_nodes[i].li_attr.full_path !== undefined) {
                    paths.push(selected_nodes[i].li_attr.full_path);
                }
            }
            this.initChainCallControl({
                length: paths.length,
                action: "adding_datasets"
            });
            if (selection_type === "folder") {
                const full_source = `${options.source}_folder`;
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
                const full_source = `${options.source}_file`;
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

    fetchAndDisplayHistoryContents: function(history_id) {
        var history_contents = new mod_library_model.HistoryContents({
            id: history_id
        });
        history_contents.fetch({
            success: history_contents => {
                var history_contents_template = this.templateHistoryContents();

                if (history_contents.length > 0) {
                    this.histories.get(history_id).set({ contents: history_contents });
                    this.modal.$el.find(".library_selected_history_content").html(
                        history_contents_template({
                            history_contents: history_contents.models.reverse()
                        })
                    );
                    this.modal.$el.find(".history-import-select-all").bind("click", () => {
                        $(".library_selected_history_content [type=checkbox]").prop("checked", true);
                    });
                    this.modal.$el.find(".history-import-unselect-all").bind("click", () => {
                        $(".library_selected_history_content [type=checkbox]").prop("checked", false);
                    });

                    this.modal.$el.find(".history-import-toggle-all").bind("click", e => {
                        this.selectAll(e);
                    });

                    this.modal.$el.find(".dataset_row").bind("click", e => {
                        this.selectClickedRow(e);
                    });
                } else {
                    this.modal.$el.find(".library_selected_history_content").html(`<p>Selected history is empty.</p>`);
                }
            },
            error: (model, response) => {
                if (typeof response.responseJSON !== "undefined") {
                    Toast.error(response.responseJSON.err_msg);
                } else {
                    Toast.error("An error occurred.");
                }
            }
        });
    },

    /**
     * Import all selected datasets from history into the current folder.
     */
    addAllDatasetsFromHistory: function() {
        var checked_hdas = this.modal.$el.find(".library_selected_history_content").find(":checked");
        var history_item_ids = []; // can be hda or hdca
        var history_item_types = [];
        var items_to_add = [];
        if (checked_hdas.length < 1) {
            Toast.info("You must select some datasets first.");
        } else {
            this.modal.disableButton("Add");
            checked_hdas.each(function() {
                var hid = $(this)
                    .closest("tr")
                    .data("id");
                if (hid) {
                    var item_type = $(this)
                        .closest("tr")
                        .data("name");
                    history_item_ids.push(hid);
                    history_item_types.push(item_type);
                }
            });
            for (let i = history_item_ids.length - 1; i >= 0; i--) {
                var history_item_id = history_item_ids[i];
                var folder_item = new mod_library_model.Item();
                folder_item.url = `${getAppRoot()}api/folders/${this.options.id}/contents`;
                if (history_item_types[i] === "collection") {
                    folder_item.set({ from_hdca_id: history_item_id });
                } else {
                    folder_item.set({ from_hda_id: history_item_id });
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
     * User clicked the checkbox in the table heading
     * @param  {context} event
     */
    selectAll: function(event) {
        var selected = event.target.checked;
        var self = this;
        // Iterate each checkbox
        $(":checkbox", "#dataset_list tbody").each(function() {
            this.checked = selected;
            var $row = $(this).closest("tr");
            // Change color of selected/unselected
            if (selected) {
                self.makeDarkRow($row);
            } else {
                self.makeWhiteRow($row);
            }
        });
    },

    /**
     * Check checkbox if user clicks on the whole row or
     *  on the checkbox itself
     */
    selectClickedRow: function(event) {
        var checkbox = "";
        var $row;
        var source;
        $row = $(event.target).closest("tr");
        if (event.target.localName === "input") {
            checkbox = event.target;
            source = "input";
        } else if (event.target.localName === "td") {
            checkbox = $row.find(":checkbox")[0];
            source = "td";
        }
        if (checkbox.checked) {
            if (source === "td") {
                checkbox.checked = "";
                this.makeWhiteRow($row);
            } else if (source === "input") {
                this.makeDarkRow($row);
            }
        } else {
            if (source === "td") {
                checkbox.checked = "selected";
                this.makeDarkRow($row);
            } else if (source === "input") {
                this.makeWhiteRow($row);
            }
        }
    },

    makeDarkRow: function($row) {
        $row.addClass("table-primary");
    },

    makeWhiteRow: function($row) {
        $row.removeClass("table-primary");
    },

    /**
     * Take array of empty history items and make request for each of them
     * to create it on server. Update progress in between calls.
     * @param  {array} history_item_set array of empty history items
     * @param  {str} history_name     name of the history to import to
     */
    chainCallImportingIntoHistory: function(history_item_set, history_name) {
        const Galaxy = getGalaxyInstance();
        var popped_item = history_item_set.pop();
        if (typeof popped_item == "undefined") {
            if (this.options.chain_call_control.failed_number === 0) {
                Toast.success("Selected datasets imported into history. Click this to start analyzing it.", "", {
                    onclick: () => {
                        window.location = getAppRoot();
                    }
                });
            } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                Toast.error("There was an error and no datasets were imported into history.");
            } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                Toast.warning(
                    "Some of the datasets could not be imported into history. Click this to see what was imported.",
                    "",
                    {
                        onclick: () => {
                            window.location = getAppRoot();
                        }
                    }
                );
            }
            Galaxy.modal.hide();
            return true;
        }
        var promise = $.when(
            popped_item.save({
                content: popped_item.content,
                source: popped_item.source
            })
        );

        promise
            .done(() => {
                this.updateProgress();
                this.chainCallImportingIntoHistory(history_item_set, history_name);
            })
            .fail(() => {
                this.options.chain_call_control.failed_number += 1;
                this.updateProgress();
                this.chainCallImportingIntoHistory(history_item_set, history_name);
            });
    },

    /**
     * Take the array of paths and create a request for each of them
     * calling them in chain. Update the progress bar in between each.
     * @param  {array} paths                    paths relative to user folder on Galaxy
     * @param  {boolean} tag_using_filenames    add tags to datasets using names of files
     */
    chainCallImportingUserdirFiles: function(options) {
        const Galaxy = getGalaxyInstance();
        const popped_item = options.paths.pop();
        if (typeof popped_item === "undefined") {
            if (this.options.chain_call_control.failed_number === 0) {
                Toast.success("Selected files imported into the current folder");
                Galaxy.modal.hide();
            } else {
                Toast.error("An error occurred.");
            }
            return true;
        }
        const post_url = `${getAppRoot()}api/libraries/datasets`;
        const post_data = {
            encoded_folder_id: this.id,
            source: options.source,
            path: popped_item,
            file_type: options.file_type,
            link_data: options.link_data,
            space_to_tab: options.space_to_tab,
            to_posix_lines: options.to_posix_lines,
            dbkey: options.dbkey,
            tag_using_filenames: options.tag_using_filenames
        };
        const promise = $.when($.post(post_url, post_data));
        promise
            .done(response => {
                this.updateProgress();
                this.chainCallImportingUserdirFiles(options);
            })
            .fail(() => {
                this.options.chain_call_control.failed_number += 1;
                this.updateProgress();
                this.chainCallImportingUserdirFiles(options);
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
    chainCallImportingFolders: function(options) {
        const Galaxy = getGalaxyInstance();
        // TODO need to check which paths to call
        const popped_item = options.paths.pop();
        if (typeof popped_item == "undefined") {
            if (this.options.chain_call_control.failed_number === 0) {
                Toast.success("Selected folders and their contents imported into the current folder.");
                Galaxy.modal.hide();
            } else {
                // TODO better error report
                Toast.error("An error occurred.");
            }
            return true;
        }
        const post_url = `${getAppRoot()}api/libraries/datasets`;
        const post_data = {
            encoded_folder_id: this.id,
            source: options.source,
            path: popped_item,
            preserve_dirs: options.preserve_dirs,
            link_data: options.link_data,
            to_posix_lines: options.to_posix_lines,
            space_to_tab: options.space_to_tab,
            file_type: options.file_type,
            dbkey: options.dbkey,
            tag_using_filenames: options.tag_using_filenames
        };
        const promise = $.when($.post(post_url, post_data));
        promise
            .done(response => {
                this.updateProgress();
                this.chainCallImportingFolders(options);
            })
            .fail(() => {
                this.options.chain_call_control.failed_number += 1;
                this.updateProgress();
                this.chainCallImportingFolders(options);
            });
    },

    /**
     * Take the array of hdas and create a request for each.
     * Call them in chain and update progress bar in between each.
     * @param  {array} hdas_set array of empty hda objects
     */
    chainCallAddingHdas: function(hdas_set) {
        const Galaxy = getGalaxyInstance();
        this.added_hdas = new mod_library_model.Folder();
        var popped_item = hdas_set.pop();
        if (typeof popped_item == "undefined") {
            if (this.options.chain_call_control.failed_number === 0) {
                Toast.success("Selected datasets from history added to the folder");
            } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                Toast.error("There was an error and no datasets were added to the folder.");
            } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                Toast.warning("Some of the datasets could not be added to the folder");
            }
            Galaxy.modal.hide();
            return this.added_hdas;
        }
        var promise = $.when(
            popped_item.save({
                from_hda_id: popped_item.get("from_hda_id")
            })
        );

        promise
            .done(model => {
                Galaxy.libraries.folderListView.collection.add(model);
                this.updateProgress();
                this.chainCallAddingHdas(hdas_set);
            })
            .fail(() => {
                this.options.chain_call_control.failed_number += 1;
                this.updateProgress();
                this.chainCallAddingHdas(hdas_set);
            });
    },

    /**
     * Take the array of lddas, create request for each and
     * call them in chain. Update progress bar in between each.
     * @param  {array} lddas_set array of lddas to delete
     */
    chainCallDeletingItems: function(items_to_delete) {
        const Galaxy = getGalaxyInstance();
        this.deleted_items = new mod_library_model.Folder();
        var item_to_delete = items_to_delete.pop();
        if (typeof item_to_delete === "undefined") {
            if (this.options.chain_call_control.failed_number === 0) {
                Toast.success("Selected items were deleted.");
            } else if (this.options.chain_call_control.failed_number === this.options.chain_call_control.total_number) {
                Toast.error(
                    "There was an error and no items were deleted. Please make sure you have sufficient permissions."
                );
            } else if (this.options.chain_call_control.failed_number < this.options.chain_call_control.total_number) {
                Toast.warning(
                    "Some of the items could not be deleted. Please make sure you have sufficient permissions."
                );
            }
            Galaxy.modal.hide();
            return this.deleted_items;
        }
        item_to_delete
            .destroy()
            .done(item => {
                Galaxy.libraries.folderListView.collection.remove(item_to_delete.id);
                this.updateProgress();
                // add the deleted item to collection, triggers rendering
                if (Galaxy.libraries.folderListView.options.include_deleted) {
                    var updated_item = null;
                    if (item.type === "folder" || item.model_class === "LibraryFolder") {
                        updated_item = new mod_library_model.FolderAsModel(item);
                    } else if (item.type === "file" || item.model_class === "LibraryDataset") {
                        updated_item = new mod_library_model.Item(item);
                    } else {
                        Galaxy.emit.error("Unknown library item type found.", "datalibs");
                        Galaxy.emit.error(item.type || item.model_class, "datalibs");
                    }
                    Galaxy.libraries.folderListView.collection.add(updated_item);
                }
                this.chainCallDeletingItems(items_to_delete);
            })
            .fail(() => {
                this.options.chain_call_control.failed_number += 1;
                this.updateProgress();
                this.chainCallDeletingItems(items_to_delete);
            });
    },

    /**
     * Handles the click on 'show deleted' checkbox
     */
    checkIncludeDeleted: function(event) {
        const Galaxy = getGalaxyInstance();
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
    deleteSelectedItems: function() {
        const Galaxy = getGalaxyInstance();
        var dataset_ids = [];
        var folder_ids = [];
        var $checkedValues = this.findCheckedRows();
        if ($checkedValues.length === 0) {
            Toast.info("You must select at least one item for deletion.");
        } else {
            var template = this.templateDeletingItemsProgressBar();
            this.modal = Galaxy.modal;
            this.modal.show({
                closing_events: true,
                title: _l("Deleting selected items"),
                body: template({}),
                buttons: {
                    Close: () => {
                        Galaxy.modal.hide();
                    }
                }
            });
            // init the control counters
            this.options.chain_call_control.total_number = 0;
            this.options.chain_call_control.failed_number = 0;
            $checkedValues.each(function() {
                var row_id = $(this)
                    .closest("tr")
                    .data("id")
                    .toString();
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
            for (let i = dataset_ids.length - 1; i >= 0; i--) {
                var dataset = new mod_library_model.Item({
                    id: dataset_ids[i]
                });
                items_to_delete.push(dataset);
            }
            for (let i = folder_ids.length - 1; i >= 0; i--) {
                var folder = new mod_library_model.FolderAsModel({
                    id: folder_ids[i]
                });
                items_to_delete.push(folder);
            }

            this.options.chain_call_control.total_number = items_total;
            // call the recursive function to call ajax one after each other (request FIFO queue)
            this.chainCallDeletingItems(items_to_delete);
        }
    },

    showLocInfo: function() {
        const Galaxy = getGalaxyInstance();
        var library = null;
        if (Galaxy.libraries.libraryListView !== null) {
            library = Galaxy.libraries.libraryListView.collection.get(this.options.parent_library_id);
            this.showLocInfoModal(library);
        } else {
            library = new mod_library_model.Library({
                id: this.options.parent_library_id
            });
            library.fetch({
                success: () => {
                    this.showLocInfoModal(library);
                },
                error: function(model, response) {
                    if (typeof response.responseJSON !== "undefined") {
                        Toast.error(response.responseJSON.err_msg);
                    } else {
                        Toast.error("An error occurred.");
                    }
                }
            });
        }
    },

    showLocInfoModal: function(library) {
        const Galaxy = getGalaxyInstance();
        var template = this.templateLocInfoInModal();
        this.modal = Galaxy.modal;
        this.modal.show({
            closing_events: true,
            title: _l("Location Details"),
            body: template({ library: library, options: this.options }),
            buttons: {
                Close: () => {
                    Galaxy.modal.hide();
                }
            }
        });
    },

    showImportModal: function(options) {
        const Galaxy = getGalaxyInstance();
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
                Toast.error("Invalid import source.");
                break;
        }
    },

    /**
     * Change the number of libs shown on page.
     */
    changePageSize: function(e) {
        if (e.type === "focusout" || (e.type === "keydown" && e.keyCode === 13)) {
            e.preventDefault();
            const Galaxy = getGalaxyInstance();
            Galaxy.libraries.preferences.set({
                folder_page_size: parseInt(e.target.value)
            });
            Galaxy.libraries.folderListView.render({
                id: this.options.id,
                show_page: 1
            });
        }
    },

    findCheckedRows: function() {
        return $("#folder_list_body").find(":checked");
    },

    findCheckedItems: function() {
        var folder_ids = [];
        var dataset_ids = [];
        this.findCheckedRows().each(function() {
            var row_id = $(this)
                .closest("tr")
                .data("id")
                .toString();
            if (row_id.substring(0, 1) == "F") {
                folder_ids.push(row_id);
            } else {
                dataset_ids.push(row_id);
            }
        });
        return { folder_ids: folder_ids, dataset_ids: dataset_ids };
    },

    showCollectionSelect: function(e) {
        e.preventDefault();
        const Galaxy = getGalaxyInstance();
        var checked_items = this.findCheckedItems();
        var template = this.templateCollectionSelectModal();

        var promise = this.fetchUserHistories();
        promise
            .done(() => {
                this.modal = Galaxy.modal;
                this.modal.show({
                    closing_events: true,
                    title: "Create History Collection from Datasets",
                    body: template({
                        selected_datasets: checked_items.dataset_ids.length,
                        histories: this.histories.models
                    }),
                    buttons: {
                        Continue: () => {
                            this.showCollectionBuilder(checked_items.dataset_ids);
                        },
                        Close: () => {
                            Galaxy.modal.hide();
                        }
                    }
                });
            })
            .fail((model, response) => {
                if (typeof response.responseJSON !== "undefined") {
                    Toast.error(response.responseJSON.err_msg);
                } else {
                    Toast.error("An error occurred.");
                }
            });
    },

    /**
     * Note: The collection creation process expects ldda_ids as ids
     * in the collection_elements array but we operate on ld_ids in libraries.
     * The code below overwrites the id with ldda_id for this reason.
     */
    showCollectionBuilder: function(checked_items) {
        const Galaxy = getGalaxyInstance();
        let collection_elements = [];
        const elements_source = this.modal.$('input[type="radio"]:checked').val();
        if (elements_source === "selection") {
            for (let i = checked_items.length - 1; i >= 0; i--) {
                const collection_item = {};
                const dataset = Galaxy.libraries.folderListView.folder_container.get("folder").get(checked_items[i]);
                collection_item.id = dataset.get("ldda_id");
                collection_item.name = dataset.get("name");
                collection_item.deleted = dataset.get("deleted");
                collection_item.state = dataset.get("state");
                collection_elements.push(collection_item);
            }
        } else if (elements_source === "folder") {
            const all_datasets = Galaxy.libraries.folderListView.folder_container.get("folder").where({ type: "file" });
            collection_elements = new Backbone.Collection(all_datasets).toJSON();
            for (var i = collection_elements.length - 1; i >= 0; i--) {
                collection_elements[i].id = collection_elements[i].ldda_id;
            }
        }
        const new_history_name = this.modal.$("input[name=history_name]").val();
        if (new_history_name !== "") {
            this.createNewHistory(new_history_name)
                .done(new_history => {
                    Toast.success("History created");
                    this.collectionImport(collection_elements, new_history.id, new_history.name);
                })
                .fail((xhr, status, error) => {
                    Toast.error("An error occurred.");
                });
        } else {
            this.select_collection_history = this.modal.$el.find("#library-collection-history-select");
            const selected_history_id = this.select_collection_history.val();
            const selected_history_name = this.select_collection_history.find("option:selected").text();
            this.collectionImport(collection_elements, selected_history_id, selected_history_name);
        }
    },

    collectionImport: function(collection_elements, history_id, history_name) {
        const modal_title = `Creating Collection in ${history_name}`;
        let creator_class;
        let creationFn;
        this.collectionType = this.modal.$el.find("#library-collection-type-select").val();
        if (this.collectionType === "list") {
            creator_class = LIST_CREATOR.ListCollectionCreator;
            creationFn = (elements, name, hideSourceItems) => {
                elements = elements.map(element => ({
                    id: element.id,
                    name: element.name,
                    src: "ldda"
                }));
                return this.createHDCA(elements, this.collectionType, name, hideSourceItems, history_id);
            };
            LIST_CREATOR.collectionCreatorModal(
                collection_elements,
                { creationFn: creationFn, title: modal_title, defaultHideSourceItems: true },
                creator_class
            );
        } else if (this.collectionType === "paired") {
            creator_class = PAIR_CREATOR.PairCollectionCreator;
            creationFn = (elements, name, hideSourceItems) => {
                elements = [
                    { name: "forward", src: "ldda", id: elements[0].id },
                    { name: "reverse", src: "ldda", id: elements[1].id }
                ];
                return this.createHDCA(elements, this.collectionType, name, hideSourceItems, history_id);
            };
            LIST_CREATOR.collectionCreatorModal(
                collection_elements,
                { creationFn: creationFn, title: modal_title, defaultHideSourceItems: true },
                creator_class
            );
        } else if (this.collectionType === "list:paired") {
            const elements = collection_elements.map(element => ({
                id: element.id,
                name: element.name,
                src: "ldda"
            }));
            PAIRED_CREATOR.pairedCollectionCreatorModal(elements, {
                historyId: history_id,
                title: modal_title,
                defaultHideSourceItems: true
            });
        } else if (this.collectionType === "rules") {
            const creationFn = (elements, collectionType, name, hideSourceItems) => {
                return this.createHDCA(elements, collectionType, name, hideSourceItems, history_id);
            };
            LIST_CREATOR.ruleBasedCollectionCreatorModal(collection_elements, "library_datasets", "collections", {
                creationFn: creationFn,
                defaultHideSourceItems: true
            });
        }
    },

    createHDCA: function(elementIdentifiers, collectionType, name, hideSourceItems, history_id, options) {
        const hdca = new HDCA_MODEL.HistoryDatasetCollection({
            history_content_type: "dataset_collection",
            collection_type: collectionType,
            history_id: history_id,
            name: name,
            hide_source_items: hideSourceItems || false,
            element_identifiers: elementIdentifiers
        });
        return hdca.save(options);
    },

    /**
     * Take the contents of the search field and send it to the list view
     * to query the collection of folder items.
     */
    searchFolder: function(event) {
        const Galaxy = getGalaxyInstance();
        const search_term = $(".folder-search-input").val();
        this.options.search_term = search_term;
        Galaxy.libraries.folderListView.searchFolder(search_term);
    },

    templateToolBar: function() {
        return _.template(
            `<div class="library_style_container">
                <div class="d-flex align-items-center mb-2">
                    <a class="mr-1 btn btn-secondary" href="list" data-toggle="tooltip" title="Go to first page">
                        <span class="fa fa-home"/>
                    </a>
                    <div>
                        <form class="form-inline">
                            <input type="text" id="folder-filter" class="form-control folder-search-input mr-1" placeholder="Search" size="15">
                            <button style="display:none;" title="Create new folder"
                                class="btn btn-secondary toolbtn-create-folder add-library-items add-library-items-folder mr-1"
                                type="button">
                                <span class="fa fa-plus"></span> Folder
                            </button>
                            <% if(multiple_add_dataset_options) { %>
                                <div title="Add datasets to current folder"
                                    class="dropdown add-library-items add-library-items-datasets mr-1" style="display:none;">
                                    <button type="button" class="btn btn-secondary dropdown-toggle" data-toggle="dropdown">
                                        <span class="fa fa-plus"></span> Datasets <span class="caret"/>
                                    </button>
                                <div class="dropdown-menu">
                                    <a class="dropdown-item" href="#folders/<%= id %>/import/history"> from History</a>
                                    <% if(Galaxy.config.user_library_import_dir !== null) { %>
                                        <a class="dropdown-item" href="#folders/<%= id %>/import/userdir">
                                            from User Directory
                                        </a>
                                    <% } %>
                                    <% if(Galaxy.config.library_import_dir !== null || Galaxy.config.allow_library_path_paste) { %>
                                        <h5 class="dropdown-header">Admins only</h5>
                                        <% if(Galaxy.config.library_import_dir !== null) { %>
                                            <a class="dropdown-item" href="#folders/<%= id %>/import/importdir">
                                                from Import Directory
                                            </a>
                                        <% } %>
                                        <% if(Galaxy.config.allow_library_path_paste) { %>
                                            <a class="dropdown-item" href="#folders/<%= id %>/import/path">
                                                from Path
                                            </a>
                                        <% } %>
                                    <% } %>
                                </div>
                            </div>
                            <% } else { %>
                                <a title="Add Datasets to Current Folder" style="display:none;"
                                    class="btn btn-secondary add-library-items add-library-items-datasets mr-1"
                                    href="#folders/<%= id %>/import/history" role="button">
                                    <span class="fa fa-plus"></span> Datasets
                                </a>
                            <% } %>
                            <div class="dropdown mr-1">
                                <button type="button" class="primary-button dropdown-toggle add-to-history"
                                    data-toggle="dropdown">
                                    <span class="fa fa-book"></span> Export to History <span class="caret"></span>
                                </button>
                                <div class="dropdown-menu" role="menu">
                                    <a href="javascript:void(0)" role="button" class="toolbtn-bulk-import add-to-history-datasets dropdown-item">
                                        as Datasets
                                    </a>
                                    <a href="javascript:void(0)" role="button" class="toolbtn-collection-import add-to-history-collection dropdown-item">
                                        as a Collection
                                    </a>
                                </div>
                            </div>
                            <div title="Download items as archive"
                                class="dropdown dataset-manipulation mr-1" style="display:none; ">
                                <button type="button" class="primary-button dropdown-toggle" data-toggle="dropdown">
                                    <span class="fa fa-save"></span> Download <span class="caret"></span>
                                </button>
                                <div class="dropdown-menu" role="menu">
                                    <a class="dropdown-item" href="#/folders/<%= id %>/download/tgz">.tar.gz</a>
                                    <a class="dropdown-item" href="#/folders/<%= id %>/download/tbz">.tar.bz</a>
                                    <a class="dropdown-item" href="#/folders/<%= id %>/download/zip">.zip</a>
                                </div>
                            </div>
                            <button data-toggle="tooltip" title="Mark items deleted"
                                class="primary-button toolbtn-bulk-delete logged-dataset-manipulation mr-1"
                                style="display:none;" type="button">
                                <span class="fa fa-trash"></span> Delete
                            </button>
                            <span class="mr-1" data-toggle="tooltip" title="Show location details">
                                <button data-id="<%- id %>" class="primary-button toolbtn-show-locinfo" type="button">
                                    <span class="fa fa-info-circle"></span>&nbsp;Details
                                </button>
                            </span>
                            <div class="form-check logged-dataset-manipulation mr-1" style="display:none;">
                                <input class="form-check-input include-deleted-datasets-chk"
                                    id="include_deleted_datasets_chk" type="checkbox" />
                                <label class="form-check-label" for="include_deleted_datasets_chk">
                                    include deleted
                                </label>
                            </div>
                        </form>
                    </div>
                </div>
                <div id="folder_items_element" />

                <div class="d-flex justify-content-center align-items-center folder-paginator mt-2 mb-2">
                    <ul class="pagination paginator mr-1" />
                    <input style="width: initial;" min="0" max="999" class="page_size form-control" type="number" value="<%- folder_page_size %>" />
                    <span class="text-muted ml-1 paginator-text" />
                </div>
            </div>`
        );
    },

    templateLocInfoInModal: function() {
        return _.template(
            `<div>
                <table class="grid table table-sm">
                    <thead>
                        <th style="width: 25%;">Library</th>
                        <th></th>
                    </thead>
                    <tbody>
                        <tr>
                            <td>name</td>
                            <td><%- library.get("name") %></td>
                        </tr>
                        <% if(library.get("description") !== "") { %>
                            <tr>
                                <td>description</td>
                                <td><%- library.get("description") %></td>
                            </tr>
                        <% } %>
                        <% if(library.get("synopsis") !== "") { %>
                            <tr>
                                <td>synopsis</td>
                                <td><%- library.get("synopsis") %></td>
                            </tr>
                        <% } %>
                        <% if(library.get("create_time_pretty") !== "") { %>
                            <tr>
                                <td>created</td>
                                <td>
                                    <span title="<%- library.get("create_time") %>">
                                        <%- library.get("create_time_pretty") %>
                                    </span>
                                </td>
                            </tr>
                        <% } %>
                        <tr>
                            <td>id</td>
                            <td><%- library.get("id") %></td>
                        </tr>
                    </tbody>
                </table>
                <table class="grid table table-sm">
                    <thead>
                        <th style="width: 25%;">Folder</th>
                        <th></th>
                    </thead>
                    <tbody>
                        <tr>
                            <td>name</td>
                            <td><%- options.folder_name %></td>
                        </tr>
                        <% if(options.folder_description !== "") { %>
                            <tr>
                                <td>description</td>
                                <td><%- options.folder_description %></td>
                            </tr>
                        <% } %>
                        <tr>
                            <td>id</td>
                            <td><%- options.id %></td>
                        </tr>
                    </tbody>
                </table>
            </div>`
        );
    },

    templateImportIntoHistoryModal: function() {
        return _.template(
            `<div>
                <div class="library-modal-item">
                    Select history:
                    <select name="import_to_history" style="width:50%; margin-bottom: 1em; " autofocus>
                        <% _.each(histories, function(history) { %>
                            <option value="<%= _.escape(history.get("id")) %>">
                                <%= _.escape(history.get("name")) %>
                            </option>
                        <% }); %>
                    </select>
                </div>
                <div class="library-modal-item">
                    or create new:
                    <input type="text" name="history_name" value=""
                        placeholder="name of the new history" style="width:50%;" />
                </div>
            </div>`
        );
    },

    templateImportIntoHistoryProgressBar: function() {
        return _.template(
            `<div class="import_text">
                Importing selected items to history <b><%= _.escape(history_name) %></b>
            </div>
            <div class="progress">
                <div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0"
                    aria-valuemax="100" style="width: 00%;">
                    <span class="completion_span">0% Complete</span>
                </div>
            </div>`
        );
    },

    templateAddingDatasetsProgressBar: function() {
        return _.template(
            `<div class="import_text">
                Adding selected datasets to library folder <b><%= _.escape(folder_name) %></b>
            </div>
            <div class="progress">
                <div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0"
                    aria-valuemax="100" style="width: 00%;">
                    <span class="completion_span">0% Complete</span>
                </div>
            </div>`
        );
    },

    templateDeletingItemsProgressBar: function() {
        return _.template(
            `<div class="import_text">
            </div>
            <div class="progress">
                <div class="progress-bar progress-bar-import" role="progressbar" aria-valuenow="0" aria-valuemin="0"
                    aria-valuemax="100" style="width: 00%;">
                    <span class="completion_span">0% Complete</span>
                </div>
            </div>`
        );
    },

    templateBrowserModal: function() {
        return _.template(
            `<div id="file_browser_modal">
                    <div style="margin-bottom:1em;">
                        <label title="Switch to selecting files" class="radio-inline import-type-switch">
                            <input type="radio" name="jstree-radio" value="jstree-disable-folders" checked="checked">
                            Choose Files
                        </label>
                        <label title="Switch to selecting folders" class="radio-inline import-type-switch">
                            <input type="radio" name="jstree-radio" value="jstree-disable-files">
                            Choose Folders
                        </label>
                    </div>
                    <div class="alert alert-info jstree-files-message">
                        All files you select will be imported into the current folder ignoring their folder structure.
                    </div>
                    <div class="alert alert-info jstree-folders-message" style="display:none;">
                        All files within the selected folders and their subfolders will be imported into the current folder.
                    </div>
                    <div style="margin-bottom:1em;">
                        <label class="checkbox-inline jstree-preserve-structure" style="display:none;">
                            <input class="preserve-checkbox" type="checkbox" value="preserve_directory_structure">
                                Preserve directory structure
                            </label>
                        <label class="checkbox-inline">
                            <input class="link-checkbox" type="checkbox" value="link_files">
                                Link files instead of copying
                        </label>
                        <label class="checkbox-inline">
                            <input class="posix-checkbox" type="checkbox" value="to_posix_lines" checked="checked">
                                Convert line endings to POSIX
                        </label>
                        <label class="checkbox-inline">
                            <input class="spacetab-checkbox" type="checkbox" value="space_to_tab">
                                Convert spaces to tabs
                        </label>
                    </div>
                    <button title="Select all files" type="button" class="button primary-button libimport-select-all">
                        Select all
                    </button>
                    <button title="Select no files" type="button" class="button primary-button libimport-select-none">
                        Unselect all
                    </button>
                    <hr /> <!-- append jstree object here -->
                    <div id="jstree_browser">
                    </div>
                    <hr />
                    <p>You can set extension type and genome for all imported datasets at once:</p>
                    <div>
                        Type: <span id="library_extension_select" class="library-extension-select" />
                        Genome: <span id="library_genome_select" class="library-genome-select" />
                    </div>
                    <br />
                    <div>
                        <label class="checkbox-inline tag-files">
                            Tag datasets based on file names
                            <input class="tag-files" type="checkbox" value="tag_using_filenames">
                        </label>
                    </div>
                </div>`
        );
    },

    templateImportPathModal: function() {
        return _.template(
            `<div id="file_browser_modal">
                <div class="alert alert-info jstree-folders-message">
                    All files within the given folders and their subfolders will be imported into the current folder.
                </div>
                <div style="margin-bottom: 0.5em;">
                    <label class="checkbox-inline">
                        <input class="preserve-checkbox" type="checkbox" value="preserve_directory_structure">
                        Preserve directory structure
                    </label>
                    <label class="checkbox-inline">
                        <input class="link-checkbox" type="checkbox" value="link_files">
                        Link files instead of copying
                    </label>
                    <br>
                    <label class="checkbox-inline">
                        <input class="posix-checkbox" type="checkbox" value="to_posix_lines" checked="checked">
                        Convert line endings to POSIX
                    </label>
                    <label class="checkbox-inline">
                        <input class="spacetab-checkbox" type="checkbox" value="space_to_tab">
                        Convert spaces to tabs
                    </label>
                </div>
                <textarea id="import_paths" class="form-control" rows="5"
                    placeholder="Absolute paths (or paths relative to Galaxy root) separated by newline" autofocus>
                </textarea>
                <hr />
                <p>You can set extension type and genome for all imported datasets at once:</p>
                <div>
                    Type: <span id="library_extension_select" class="library-extension-select"></span>
                    Genome: <span id="library_genome_select" class="library-genome-select"></span>
                </div>
                <div>
                    <label class="checkbox-inline tag-files">
                        Tag datasets based on file names
                        <input class="tag-files" type="checkbox" value="tag_using_filenames">
                    </label>
                </div>
            </div>`
        );
    },

    templateAddFilesFromHistory: function() {
        return _.template(
            `<div id="add_files_modal">
                <div class="form-group">
                    <label>1. Select history:</label>
                    <select id="dataset_add_bulk" name="dataset_add_bulk" class="form-control">
                        <% _.each(histories, function(history) { %> <!-- history select box -->
                            <option value="<%= _.escape(history.get("id")) %>">
                                <%= _.escape(history.get("name")) %>
                            </option>
                        <% }); %>
                    </select>
                </div>
                <div class="library_selected_history_content">
                </div>
            </div>`
        );
    },

    templateHistoryContents: function() {
        return _.template(
            `<div class="form-group">
                <label>2. Choose the datasets to import:</label>
                <div class="library_style_container" style="width: 100%;" id="dataset_list">
                    <table class="grid table table-hover table-sm">
                        <thead>
                            <tr>
                                <th style="width: 30px;" class="mid" title="Check to select all datasets">
                                    <input class="history-import-toggle-all" style="margin: 0;" type="checkbox" />
                                </th>
                                <th style="width: 30px;"></th>
                                <th>Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            <% _.each(history_contents, function(history_item) { %>
                                <% if (history_item.get("deleted") != true ) { %>
                                    <% var item_name = history_item.get("name") %>
                                    <% if (history_item.get("type") === "collection") { %>
                                        <% var collection_type = history_item.get("collection_type") %>
                                        <% if (collection_type === "list") { %>
                                            <tr class="dataset_row" data-id="<%= _.escape(history_item.get("id")) %>"
                                                data-name="<%= _.escape(history_item.get("type")) %>">
                                                <td><input style="margin: 0;" type="checkbox"></td>
                                                <td><%= _.escape(history_item.get("hid")) %></td>
                                                <td>
                                                    <%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %>
                                                    (Dataset Collection)
                                                </td>
                                            </tr>
                                        <% } else { %>
                                            <tr class="dataset_row" title="You can convert this collection into a collection of type list using the Collection Tools">
                                                <td><input style="margin: 0;" type="checkbox" onclick="return false;" disabled="disabled" /></td>
                                                <td><%= _.escape(history_item.get("hid")) %></td>
                                                <td>
                                                    <%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %>
                                                    (Dataset Collection of type <%= _.escape(collection_type) %> not supported.)
                                                </td>
                                            </tr>
                                        <% } %>
                                    <% } else if (history_item.get("visible") === true && history_item.get("state") === "ok") { %>
                                        <tr class="dataset_row" data-id="<%= _.escape(history_item.get("id")) %>"
                                            data-name="<%= _.escape(history_item.get("type")) %>">
                                            <td><input style="margin: 0;" type="checkbox"></td>
                                            <td><%= _.escape(history_item.get("hid")) %></td>
                                            <td>
                                                <%= item_name.length > 75 ? _.escape("...".concat(item_name.substr(-75))) : _.escape(item_name) %>
                                            </td>
                                        </tr>
                                    <% } %>
                                <% } %>
                            <% }); %>
                        </tbody>
                    </table>
                </div>
            </div>`
        );
    },

    templatePaginator: function() {
        return _.template(
            `
                <% if ( ( show_page - 1 ) > 0 ) { %>
                    <% if ( ( show_page - 1 ) > page_count ) { %> <!-- we are on higher page than total page count -->
                        <li class="page-item">
                            <a class="page-link" href="#folders/<%= id %>/page/1">
                                <span class="fa fa-angle-double-left"></span>
                            </a>
                        </li>
                        <li class="page-item disabled">
                            <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page ) %>">
                                <% print( show_page - 1 ) %>
                            </a>
                        </li>
                    <% } else { %>
                        <li class="page-item">
                            <a class="page-link" href="#folders/<%= id %>/page/1">
                                <span class="fa fa-angle-double-left"></span>
                            </a>
                        </li>
                        <li class="page-item">
                            <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page - 1 ) %>">
                                <% print( show_page - 1 ) %>
                            </a>
                        </li>
                    <% } %>
                <% } else { %> <!-- we are on the first page -->
                    <li class="page-item disabled">
                        <a class="page-link" href="#folders/<%= id %>/page/1">
                            <span class="fa fa-angle-double-left"></span>
                        </a>
                    </li>
                    <li class="page-item disabled">
                        <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page ) %>">
                            <% print( show_page - 1 ) %>
                        </a>
                    </li>
                <% } %>
                <li class="page-item active">
                    <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page ) %>">
                        <% print( show_page ) %>
                    </a>
                </li>
                <% if ( ( show_page ) < page_count ) { %>
                    <li class="page-item">
                        <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page + 1 ) %>">
                            <% print( show_page + 1 ) %>
                        </a>
                    </li>
                    <li class="page-item">
                        <a class="page-link" href="#folders/<%= id %>/page/<% print( page_count ) %>">
                            <span class="fa fa-angle-double-right"></span>
                        </a>
                    </li>
                <% } else { %>
                    <li class="page-item disabled">
                        <a class="page-link" href="#folders/<%= id %>/page/<% print( show_page  ) %>">
                            <% print( show_page + 1 ) %>
                        </a>
                    </li>
                    <li class="page-item disabled">
                        <a class="page-link" href="#folders/<%= id %>/page/<% print( page_count ) %>">
                            <span class="fa fa-angle-double-right"></span>
                        </a>
                    </li>
                <% } %>
            `
        );
    },

    templatePaginatorText: function() {
        return _.template(`per page,
            <%- total_items_count %> total`);
    },

    templateCollectionSelectModal: function() {
        return _.template(
            `<div> <!-- elements selection -->
                <div class="library-modal-item">
                    <h4>Which datasets?</h4>
                    <form class="form-inline">
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="radio_elements" id="selection_radio" value="selection"
                                <% if (!selected_datasets) { %> disabled <% } else { %> checked <% } %> />
                            <label class="form-check-label" for="selection_radio">
                                current selection
                                <% if (selected_datasets) { %>
                                    (<%- selected_datasets %>)
                                <% } %>
                            </label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="radio_elements" id="folder_radio" value="folder" <% if (!selected_datasets) { %> checked <% } %> >
                            <label class="form-check-label" for="folder_radio">all datasets in current folder</label>
                        </div>
                    </form>
                </div>
                <!-- type selection -->
                <div class="library-modal-item">
                    <h4>Collection type</h4>
                    <div class="form-group">
                        <select id="library-collection-type-select" name="library-collection-type-select" class="form-control">
                            <option value="list">List</option>
                            <option value="paired">Paired</option>
                            <option value="list:paired">List of Pairs</option>
                            <option value="rules">From Rules</option>
                        </select>
                    </div>
                    <h5>Which type to choose?</h5>
                    <dl class="row">
                        <dt class="col-sm-3">List</dt>
                        <dd class="col-sm-9">Generic collection which groups any number of datasets into a set; similar to file system folder.</dd>

                        <dt class="col-sm-3">Paired</dt>
                        <dd class="col-sm-9">Simple collection containing exactly two sequence datasets; one reverse and the other forward.</dd>

                        <dt class="col-sm-3">List of Pairs</dt>
                        <dd class="col-sm-9">Advanced collection containing any number of Pairs; imagine as Pair-type collections inside of a List-type collection.</dd>

                        <dt class="col-sm-3">From Rules</dt>
                        <dd class="col-sm-9">Use Galaxy's rule builder to describe collections. This is more of an advanced feature that allows building any number of collections or any type.</dd>
                    </dl>
                </div>
                <!-- history selection/creation -->
                <div class="library-modal-item">
                    <h4>Select history</h4>
                    <div class="form-group">
                        <select id="library-collection-history-select" name="library-collection-history-select" class="form-control">
                            <% _.each(histories, function(history) { %> <!-- history select box -->
                                <option value="<%= _.escape(history.get("id")) %>">
                                    <%= _.escape(history.get("name")) %>
                                </option>
                            <% }); %>
                        </select>
                        <label>or create new:</label>
                        <input class="form-control" type="text" name="history_name" value="" placeholder="name of the new history" />
                    </div>
                </div>
            </div>`
        );
    }
});

export default {
    FolderToolbarView: FolderToolbarView
};
