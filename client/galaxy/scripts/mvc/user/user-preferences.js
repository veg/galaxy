/** User Preferences view */
import _ from "underscore";
import $ from "jquery";
import Backbone from "backbone";
import { getAppRoot } from "onload/loadConfig";
import { getGalaxyInstance } from "app";
import _l from "utils/localization";
// import Form from "mvc/form/form-view";
import Ui from "mvc/ui/ui-misc";
import QueryStringParsing from "utils/query-string-parsing";

/** Contains descriptive dictionaries describing user forms */
const Model = Backbone.Model.extend({
    initialize: function(options) {
        const Galaxy = getGalaxyInstance();
        options = options || {};
        options.user_id = options.user_id || Galaxy.user.id;
        this.set({
            user_id: options.user_id,
            information: {
                title: _l("Manage information"),
                description: "Edit your email, addresses and custom parameters or change your public name.",
                url: `api/users/${options.user_id}/information/inputs`,
                icon: "fa-user",
                redirect: "user"
            },
            password: {
                title: _l("Change password"),
                description: _l("Allows you to change your login credentials."),
                icon: "fa-unlock-alt",
                url: `api/users/${options.user_id}/password/inputs`,
                submit_title: "Save password",
                redirect: "user"
            },
            communication: {
                title: _l("Change communication settings"),
                description: _l("Enable or disable the communication feature to chat with other users."),
                url: `api/users/${options.user_id}/communication/inputs`,
                icon: "fa-comments-o",
                redirect: "user"
            },
            permissions: {
                title: _l("Set dataset permissions for new histories"),
                description:
                    "Grant others default access to newly created histories. Changes made here will only affect histories created after these settings have been stored.",
                url: `api/users/${options.user_id}/permissions/inputs`,
                icon: "fa-users",
                submit_title: "Save permissions",
                redirect: "user"
            },
            make_data_private: {
                title: _l("Make all data private"),
                description: _l("Click here to make all data private."),
                icon: "fa-lock",
                onclick: function() {
                    if (
                        confirm(
                            _l(
                                "WARNING: This will make all datasets (excluding library datasets) for which you have " +
                                    "'management' permissions, in all of your histories " +
                                    "private, and will set permissions such that all " +
                                    "of your new data in these histories is created as private.  Any " +
                                    "datasets within that are currently shared will need " +
                                    "to be re-shared or published.  Are you sure you " +
                                    "want to do this?"
                            )
                        )
                    ) {
                        $.post(`${Galaxy.root}history/make_private`, { all_histories: true }, () => {
                            Galaxy.modal.show({
                                title: _l("Datasets are now private"),
                                body: `All of your histories and datsets have been made private.  If you'd like to make all *future* histories private please use the <a href="${
                                    Galaxy.root
                                }user/permissions">User Permissions</a> interface.`,
                                buttons: {
                                    Close: function() {
                                        Galaxy.modal.hide();
                                    }
                                }
                            });
                        });
                    }
                }
            },
            api_key: {
                title: _l("Manage API key"),
                description: _l("Access your current API key or create a new one."),
                url: `api/users/${options.user_id}/api_key/inputs`,
                icon: "fa-key",
                submit_title: "Create a new key",
                submit_icon: "fa-check"
            },
            cloud_auth: {
                title: _l("Manage Cloud Authorization"),
                description: _l(
                    "Add or modify the configuration that grants Galaxy to access your cloud-based resources."
                ),
                icon: "fa-cloud",
                submit_title: "Create a new key",
                submit_icon: "fa-check"
            },
            toolbox_filters: {
                title: _l("Manage Toolbox filters"),
                description: _l("Customize your Toolbox by displaying or omitting sets of Tools."),
                url: `api/users/${options.user_id}/toolbox_filters/inputs`,
                icon: "fa-filter",
                submit_title: "Save filters",
                redirect: "user"
            },
            custom_builds: {
                title: _l("Manage custom builds"),
                description: _l("Add or remove custom builds using history datasets."),
                icon: "fa-cubes",
                onclick: function() {
                    Galaxy.page.router.push(`${getAppRoot()}custom_builds`);
                }
            },
            genomespace: {
                title: _l("Request GenomeSpace token"),
                description: _l("Requests token through OpenID."),
                icon: "fa-openid",
                onclick: function() {
                    window.location.href = `${getAppRoot()}openid/openid_auth?openid_provider=genomespace`;
                }
            },
            logout: {
                title: _l("Sign out"),
                description: _l("Click here to sign out of all sessions."),
                icon: "fa-sign-out",
                onclick: function() {
                    Galaxy.modal.show({
                        title: _l("Sign out"),
                        body: "Do you want to continue and sign out of all active sessions?",
                        buttons: {
                            Cancel: function() {
                                Galaxy.modal.hide();
                            },
                            "Sign out": function() {
                                window.location.href = `${getAppRoot()}user/logout?session_csrf_token=${
                                    Galaxy.session_csrf_token
                                }`;
                            }
                        }
                    });
                }
            }
        });
    }
});

/** View of the main user preference panel with links to individual user forms */
const View = Backbone.View.extend({
    title: _l("User Preferences"),
    active_tab: "user",
    initialize: function() {
        this.model = new Model();
        this.setElement("<div/>");
        this.render();
    },

    render: function() {
        const Galaxy = getGalaxyInstance();
        const config = Galaxy.config;
        $.getJSON(`${getAppRoot()}api/users/${Galaxy.user.id}`, data => {
            this.$preferences = $("<div/>")
                .append($("<h2/>").append("User preferences"))
                .append($("<p/>").append(`You are logged in as <strong>${_.escape(data.email)}</strong>.`))
                .append((this.$table = $("<table/>")));
            const message = QueryStringParsing.get("message");
            const status = QueryStringParsing.get("status");
            if (message && status) {
                this.$preferences.prepend(new Ui.Message({ message: message, status: status }).$el);
            }
            if (!config.use_remote_user) {
                this._addLink("information");
                this._addLink("password");
            }
            if (config.enable_communication_server) {
                this._addLink("communication");
            }
            this._addLink("custom_builds");
            this._addLink("permissions");
            this._addLink("make_data_private");
            this._addLink("api_key");
            this._addLink("cloud_auth");
            if (config.enable_openid) {
                this._addLink("genomespace");
            }
            if (config.has_user_tool_filters) {
                this._addLink("toolbox_filters");
            }
            if (Galaxy.session_csrf_token) {
                this._addLink("logout");
            }
            this.$preferences.append(this._templateFooter(data));
            this.$el.empty().append(this.$preferences);
        });
    },

    _addLink: function(action) {
        const options = this.model.get(action);
        const $row = $(this._templateLink(options));
        const $a = $row.find("a");
        if (options.onclick) {
            $a.on("click", () => {
                options.onclick();
            });
        } else {
            $a.attr("href", `${getAppRoot()}user/${action}`);
        }
        this.$table.append($row);
    },

    _templateLink: function(options) {
        return `<tr>
                    <td class="align-top">
                        <i class="ml-3 mr-3 fa fa-lg ${options.icon}">
                    </td>
                    <td>
                        <a href="javascript:void(0)"><b>${options.title}</b></a>
                        <div class="form-text text-muted">${options.description}</div>
                    </td>
                </tr>`;
    },

    _templateFooter: function(options) {
        const Galaxy = getGalaxyInstance();
        return `<p class="mt-2">You are using <strong>${
            options.nice_total_disk_usage
        }</strong> of disk space in this Galaxy instance. ${
            Galaxy.config.enable_quotas ? `Your disk quota is: <strong>${options.quota}</strong>. ` : ""
        }Is your usage more than expected? See the <a href="https://galaxyproject.org/learn/managing-datasets/" target="_blank"><b>documentation</b></a> for tips on how to find all of the data in your account.</p>`;
    }
});

export default {
    View: View,
    Model: Model
};
