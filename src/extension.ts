import * as vscode from 'vscode';
import * as path from 'path';
import { MDXPreviewProvider } from './previewProvider';

let previewPanel: vscode.WebviewPanel | undefined = undefined;

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = undefined;
    }, wait);
  };
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Docusaurus MDX Previewer extension is now active');

    const provider = new MDXPreviewProvider(context.extensionUri);

    // const providerRegistration = vscode.window.registerCustomEditorProvider(
    //   'docusaurus.mdxPreview',
    //   provider,
    //   {
    //     webviewOptions: {
    //       retainContextWhenHidden: true,
    //     }
    //   }
    // );

    const previewCommand = vscode.commands.registerCommand('docusaurus-preview.showPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      const document = editor.document;
      if (document.languageId !== 'markdown' && document.languageId !== 'mdx') {
        vscode.window.showErrorMessage('Current document is not a markdown or MDX file');
        return;
      }

      if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
        previewPanel.title = `Preview: ${path.basename(document.fileName)}`;
        provider.updatePreview(previewPanel.webview, document);
      } else {
        previewPanel = vscode.window.createWebviewPanel(
          'docusaurus.mdxPreview',
          `Preview: ${path.basename(document.fileName)}`,
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.dirname(document.fileName)),
              context.extensionUri,
            ]
          }
        );

        previewPanel.webview.html = provider.getMDXHtmlForWebview(context, previewPanel.webview);
        provider.updatePreview(previewPanel.webview, document);

        previewPanel.onDidDispose(() => {
          previewPanel = undefined;
        });
      }
    });

    const editorChangeSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || !previewPanel) { return; }
  
      const document = editor.document;
      if (document.languageId === 'markdown' || document.languageId === 'mdx') {
        previewPanel.title = `Preview: ${path.basename(document.fileName)}`;
        provider.updatePreview(previewPanel.webview, document);
      }
    });

    const config = vscode.workspace.getConfiguration('docusaurusMdxPreview');
    const refreshInterval = config.get<number>('refreshInterval') || 500;

    const debouncedUpdatePreview = debounce((webview: vscode.Webview, document: vscode.TextDocument) => {
      provider.updatePreview(webview, document);
    }, refreshInterval);

    const documentChangeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (!previewPanel || !vscode.window.activeTextEditor) { return; }
      if (e.document.uri.toString() === vscode.window.activeTextEditor.document.uri.toString()) {
        debouncedUpdatePreview(previewPanel.webview, e.document);
      }
    });
  
    context.subscriptions.push(
      // providerRegistration,
      previewCommand,
      editorChangeSubscription,
      documentChangeSubscription
    );
}

export function deactivate() {
  if (previewPanel) {
    previewPanel.dispose();
    previewPanel = undefined;
  }
}
