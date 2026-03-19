import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "jj-dojo" is now active!');

  // TODO: kevincliao - Remove this once the extension is mature.
  context.subscriptions.push(
    vscode.commands.registerCommand("jj-dojo.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World");
    })
  );
}

export function deactivate() {}
