import Backbone from "backbone";
import $ from "jquery";
import Tools from "mvc/tool/tools";
import Upload from "mvc/upload/upload-view";
import _l from "utils/localization";
// import ToolForm from "mvc/tool/tool-form-composite";
import _ from "libs/underscore";
import { getGalaxyInstance } from "app";
import { getAppRoot } from "onload";
import Buttons from "mvc/ui/ui-buttons";

const ToolPanel = Backbone.View.extend({
    initialize: function(page, options) {
        const Galaxy = getGalaxyInstance();
        const appRoot = getAppRoot();

        // access configuration options
        const config = options.config;
        this.root = options.root;

        /** @type {Object[]} descriptions of user's workflows to be shown in the tool menu */
        this.stored_workflow_menu_entries = config.stored_workflow_menu_entries || [];

        // create tool search, tool panel, and tool panel view.
        const tool_search = new Tools.ToolSearch({
            hidden: false
        });
        const tools = new Tools.ToolCollection(config.toolbox);
        this.tool_panel = new Tools.ToolPanel({
            tool_search: tool_search,
            tools: tools,
            layout: config.toolbox_in_panel
        });
        this.tool_panel_view = new Tools.ToolPanelView({
            model: this.tool_panel
        });

        // add upload modal
        this.upload_button = new Upload({
            upload_path: config.nginx_upload_path || `${appRoot}api/tools`,
            chunk_upload_size: config.chunk_upload_size,
            ftp_upload_site: config.ftp_upload_site,
            default_genome: config.default_genome,
            default_extension: config.default_extension
        });
        const panel_buttons = [this.upload_button];

        // add favorite filter button
        if (Galaxy.user && Galaxy.user.id) {
            this.favorite_button = new Buttons.ButtonLink({
                cls: "panel-header-button",
                title: _l("Show favorites"),
                icon: "fa fa-star-o",
                onclick: e => {
                    const $search_query = $("#tool-search-query");
                    const $header_btn = $(".panel-header-button");
                    $header_btn.find(".fa").toggleClass("fa-star-o fa-star");
                    $header_btn.tooltip("hide");
                    if ($search_query.val().indexOf("#favorites") != -1) {
                        $search_query.val("");
                        $search_query.keyup();
                        $header_btn.attr("title", "");
                    } else {
                        $search_query.val("#favorites").trigger("change");
                    }
                }
            });
            panel_buttons.push(this.favorite_button);
        }
        // add uploader button to Galaxy object
        Galaxy.upload = this.upload_button;

        // components for panel definition
        this.model = new Backbone.Model({
            title: _l("Tools"),
            buttons: panel_buttons
        });

        // build body template
        this.setElement(this._template());
    },

    render: function() {
        // if there are tools, render panel and display everything
        if (this.tool_panel.get("layout").size() > 0) {
            this.$el.find(".toolMenu").replaceWith(this.tool_panel_view.$el);
            this.tool_panel_view.render();
        }
        // build the dom for the workflow portion of the tool menu
        // add internal workflow list
        this.$("#internal-workflows").append(
            this._templateAllWorkflow({
                title: _l("All workflows"),
                href: "workflows/list"
            })
        );
        _.each(this.stored_workflow_menu_entries, menu_entry => {
            this.$("#internal-workflows").append(
                this._templateWorkflowLink({
                    title: menu_entry.stored_workflow.name,
                    href: `workflows/run?id=${menu_entry.encoded_stored_workflow_id}`
                })
            );
        });
    },

    /** build a link to one tool */
    _templateTool: function(tool) {
        const appRoot = getAppRoot();
        return `<div class="toolTitle">
                    <a href="${appRoot}${tool.href}" target="galaxy_main">
                        ${tool.title}
                    </a>
                </div>`;
    },

    /** build a link to 'All Workflows' */
    _templateAllWorkflow: function(tool) {
        const appRoot = getAppRoot();
        return `<div class="toolTitle">
                    <a href="${appRoot}${tool.href}">
                        ${tool.title}
                    </a>
                </div>`;
    },

    /** build links to workflows in toolpanel */
    _templateWorkflowLink: function(wf) {
        const appRoot = getAppRoot();
        return `<div class="toolTitle">
                    <a class="${wf.cls}" href="${appRoot}${wf.href}">
                        ${_.escape(wf.title)}
                    </a>
                </div>`;
    },

    /** override to include inital menu dom and workflow section */
    _template: function() {
        return `<div class="toolMenuContainer">
                    <div class="toolMenu" style="display: none">
                        <div id="search-no-results" style="display: none; padding-top: 5px">
                            <em>
                                <strong>
                                    ${_l("Search did not match any tools.")}
                                </strong>
                            </em>
                        </div>
                    </div>
                    <div class="toolSectionPad"/>
                    <div class="toolSectionPad"/>
                    <div class="toolSectionTitle" id="title_XXinternalXXworkflow">
                        <a>
                            ${_l("Workflows")}
                        </a>
                    </div>
                        <div id="internal-workflows" class="toolSectionBody">
                            <div class="toolSectionBg"/>
                        </div>
                </div>`;
    },

    toString: function() {
        return "toolPanel";
    }
});

export default ToolPanel;
