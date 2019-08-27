import $ from "jquery";
import axios from "axios";
import { Toast } from "ui/toast";
import { getAppRoot } from "onload/loadConfig";
import { PageEditor } from "components/PageEditor";
import Vue from "vue";

export default function pagesEditorOnload() {
    const pageId = $("#page-editor-content").attr("page_id");
    axios
        .get(`${getAppRoot()}api/pages/${pageId}`)
        .then(response => {
            const pageEditorInstance = Vue.extend(PageEditor);
            new pageEditorInstance({
                propsData: {
                    pageId: pageId,
                    content: response.data.content,
                    title: response.data.title
                },
                el: "#page-editor-content"
            });
        })
        .catch(e => {
            const response = e.response;
            if (typeof response.responseJSON !== "undefined") {
                Toast.error(response.responseJSON.err_msg);
            } else {
                Toast.error("An error occurred.");
            }
        });
}
