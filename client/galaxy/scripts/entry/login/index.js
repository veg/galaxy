import { standardInit, addInitialization } from "onload";
import Page from "layout/page";
import Index from "components/login/Index.vue";
import Password from "components/login/Password.vue";
import Vue from "vue";

export function initLoginView(Galaxy, { options }) {
    console.log("initLoginView");
    Galaxy.page = new Page.View(options);
    const vm = document.createElement("div");
    Galaxy.display(vm);
    const component = Galaxy.params.token || Galaxy.params.expired_user ? Password : Index;
    const loginInstance = Vue.extend(component);
    new loginInstance({ propsData: options }).$mount(vm);
}

addInitialization(initLoginView);

window.addEventListener("load", () => standardInit("login"));
