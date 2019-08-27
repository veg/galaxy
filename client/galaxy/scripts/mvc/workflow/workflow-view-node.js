import $ from "jquery";
import _ from "libs/underscore";
import Backbone from "backbone";
import TerminalViews from "mvc/workflow/workflow-view-terminals";
import DataViews from "mvc/workflow/workflow-view-data";

export default Backbone.View.extend({
    initialize: function(options) {
        this.node = options.node;
        this.output_width = Math.max(150, this.$el.width());
        this.tool_body = this.$el.find(".toolFormBody");
        this.tool_body.find("div").remove();
        this.newInputsDiv().appendTo(this.tool_body);
        this.terminalViews = {};
        this.outputViews = {};
    },

    render: function() {
        this.renderToolLabel();
        this.renderToolErrors();
        this.$el.css("width", Math.min(250, Math.max(this.$el.width(), this.output_width)));
    },

    renderToolLabel: function() {
        this.$(".nodeTitle").text(this.node.label || this.node.name);
        this.$el.attr("node-label", this.node.label);
    },

    renderToolErrors: function() {
        this.node.errors ? this.$el.addClass("tool-node-error") : this.$el.removeClass("tool-node-error");
    },

    newInputsDiv: function() {
        return $("<div/>").addClass("inputs");
    },

    updateMaxWidth: function(newWidth) {
        this.output_width = Math.max(this.output_width, newWidth);
    },

    addRule: function() {
        this.tool_body.append($("<div/>").addClass("rule"));
    },

    addDataInput: function(input, body) {
        var skipResize = true;
        if (!body) {
            body = this.$(".inputs");
            // initial addition to node - resize input to help calculate node
            // width.
            skipResize = false;
        }
        var terminalView = this.terminalViews[input.name];
        var terminalViewClass = TerminalViews.InputTerminalView;
        if (input.input_type == "dataset_collection") {
            terminalViewClass = TerminalViews.InputCollectionTerminalView;
        } else if (input.input_type == "parameter") {
            terminalViewClass = TerminalViews.InputParameterTerminalView;
        }
        if (terminalView && !(terminalView instanceof terminalViewClass)) {
            terminalView.el.terminal.destroy();
            terminalView = null;
        }
        if (!terminalView) {
            terminalView = new terminalViewClass({
                node: this.node,
                input: input
            });
        } else {
            var terminal = terminalView.el.terminal;
            terminal.update(input);
            terminal.destroyInvalidConnections();
        }
        this.terminalViews[input.name] = terminalView;
        var terminalElement = terminalView.el;
        var inputView = new DataViews.DataInputView({
            terminalElement: terminalElement,
            input: input,
            nodeView: this,
            skipResize: skipResize
        });
        var ib = inputView.$el;
        body.append(ib.prepend(terminalView.terminalElements()));
        return terminalView;
    },

    terminalViewForOutput: function(output) {
        let terminalViewClass = TerminalViews.OutputTerminalView;
        if (output.collection) {
            terminalViewClass = TerminalViews.OutputCollectionTerminalView;
        } else if (output.parameter) {
            terminalViewClass = TerminalViews.OutputParameterTerminalView;
        }
        return new terminalViewClass({
            node: this.node,
            output: output
        });
    },

    outputViewforOutput: function(output, terminalView) {
        const outputViewClass = output.parameter ? DataViews.ParameterOutputView : DataViews.DataOutputView;
        return new outputViewClass({
            output: output,
            terminalElement: terminalView.el,
            nodeView: this
        });
    },

    addDataOutput: function(output) {
        const terminalView = this.terminalViewForOutput(output);
        const outputView = this.outputViewforOutput(output, terminalView);
        this.outputViews[output.name] = outputView;
        this.tool_body.append(outputView.$el.append(terminalView.terminalElements()));
    },

    redrawWorkflowOutputs: function() {
        _.each(this.outputViews, outputView => {
            outputView.redrawWorkflowOutput();
        });
    },

    updateDataOutput: function(output) {
        var outputTerminal = this.node.output_terminals[output.name];
        outputTerminal.update(output);
    }
});
