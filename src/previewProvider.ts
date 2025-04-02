import * as vscode from 'vscode';
import * as path from 'path';
import { MDXProcessor } from './mdxProcessor';

export class MDXPreviewProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(
    private readonly extensionUri: vscode.Uri
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri;
    const doc = await vscode.workspace.openTextDocument(uri);
    this.updatePreview(webviewPanel.webview, doc);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === uri.toString()) {
        this.updatePreview(webviewPanel.webview, e.document);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  async updatePreview(webview: vscode.Webview, document: vscode.TextDocument): Promise<void> {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(document.fileName)),
        this.extensionUri,
      ]
    };

    const config = vscode.workspace.getConfiguration('docusaurusMdxPreview');
    const plantumlServer = config.get<string>('plantumlServer') || 'https://kroki.io';
    
    let text = document.getText();
    const fileDir = path.dirname(document.fileName);
    const baseUrl = vscode.Uri.file(fileDir).toString() + '/';
    const imageResults = this.processImages(text, document.fileName, webview);
    const plantumlResults = await this.processPlantUML(imageResults.processedText, plantumlServer);
    const mermaidResults = await this.processMermaid(plantumlResults.processedText, plantumlServer);

    const diagrams = [...plantumlResults.diagrams, ...mermaidResults.diagrams];
    const images = imageResults.images;
    text = mermaidResults.processedText;

    try {
      const mdxCode = await MDXProcessor.process({
        content: text,
        filePath: document.fileName
      });

      webview.postMessage({
        type: 'update',
        code: mdxCode,
        baseUrl,
        diagrams: diagrams.map(d => ({ id: d.id, svg: d.svg })),
        images,
      });
    } catch (error: any) {
      console.error('MDX Process Error:', error);
      webview.postMessage({
        type: 'update',
        code: this.getErrorHtml(error.toString()),
      });
    }
  }

  public getMDXHtmlForWebview(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const reactScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'js', 'react.production.min.js'));
    const reactDomScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'js', 'react-dom.production.min.js'));
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'css', 'styles.css'));

    const csp = `
      default-src 'self';
      script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource};
      style-src 'unsafe-inline' ${webview.cspSource};
      img-src ${webview.cspSource} https: http: data:;
      connect-src https: http:;
    `;

    return `
        <!DOCTYPE html>
        <html lang="en" class="docs-wrapper" data-theme="light">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="${csp}">
            <title>Docusaurus MDX Preview</title>
            <style>
              html, body {
                margin: 0;
                padding: 20px;
                background-color: #ffffff;
                color: #333333;
                font-family: system-ui, -apple-system, sans-serif;
              }
              [style*="--vscode-"] {
                all: initial;
              }
              body * {
                box-sizing: border-box;
              }
            </style>
            <link rel="stylesheet" href="${cssUri}">
        </head>
        <body>
          <main class="docMainContainer_TBSr">
            <div class="container">
              <div id="root" class="theme-doc-markdown markdown"></div>
            </div>
          </main>
          <script src="${reactScriptUri}"></script>
          <script src="${reactDomScriptUri}"></script>
          <script>
            const root = document.getElementById('root');
            if (!root) {
              document.body.innerHTML = '<p>Error: Root element not found.</p>';
              throw new Error('Root element not found');
            }

            window.addEventListener('message', (event) => {
              const message = event.data;
              if (message.type === 'update') {
                try {
                  const code = String(message.code);
                  const baseUrl = message.baseUrl;
                  const render = new Function('options', code);
                  const Component = render({ baseUrl });
                  if (Component && typeof Component.default === 'function') {
                    ReactDOM.render(Component.default({}), root);
                  } else {
                    ReactDOM.render(Component, root);
                  }

                  if (message.images) {
                    message.images.forEach(({ src, resolvedSrc }) => {
                      const imgElements = document.querySelectorAll(\`img[src="\${src}"]\`);
                      imgElements.forEach(img => {
                        img.src = resolvedSrc;
                        img.onerror = () => img.alt = 'Image failed to load: ' + src;
                      });
                    });
                  }

                  if (message.diagrams) {
                    message.diagrams.forEach(({ id, svg }) => {
                      const element = document.getElementById(id);
                      if (element) {
                        element.innerHTML = svg;
                      }
                    });
                  }
                } catch (e) {
                  root.innerHTML = '<pre>Render error: ' + e.message + '</pre>';
                }
              } else if (message.type === 'error') {
                root.innerHTML = '<pre>MDX error: ' + message.message + '</pre>';
              }
            });
          </script>
        </body>
        </html>
    `;
  }

  private getErrorHtml(errorMessage: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - Docusaurus MDX Preview</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            padding: 20px;
            color: #d32f2f;
          }
          .error-container {
            background-color: #ffebee;
            border-left: 4px solid #d32f2f;
            padding: 16px;
            border-radius: 0 4px 4px 0;
          }
          pre {
            background-color: #f8f8f8;
            padding: 12px;
            overflow: auto;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h2>MDX Render Error</h2>
          <pre>${errorMessage}</pre>
        </div>
      </body>
      </html>
    `;
  }

  private processImages(
    text: string,
    filePath: string,
    webview: vscode.Webview
  ): { processedText: string; images: { src: string; resolvedSrc: string }[] } {
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const matches: { src: string; original: string }[] = [];
    let match;

    while ((match = imageRegex.exec(text)) !== null) {
      matches.push({ src: match[2], original: match[0] });
    }

    if (matches.length === 0) { return { processedText: text, images: [] }; }

    const images: { src: string; resolvedSrc: string }[] = [];
    const fileDir = path.dirname(filePath);

    matches.forEach(({ src }) => {
      let resolvedSrc: string;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        resolvedSrc = src;
      } else {
        const absolutePath = path.resolve(fileDir, src);
        resolvedSrc = webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
      }
      images.push({ src, resolvedSrc });
    });

    return { processedText: text, images };
  }

  private async processPlantUML(text: string, serverUrl: string): Promise<{ processedText: string; diagrams: { id: string; svg: string }[] }> {
    const plantUmlRegex = /```plantuml\n([\s\S]*?)\n```/g;
    const matches: { code: string; original: string }[] = [];
    let match;

    while ((match = plantUmlRegex.exec(text)) !== null) {
      matches.push({ code: match[1], original: match[0] });
    }

    if (matches.length === 0) { return { processedText: text, diagrams: [] }; }

    const diagrams: { id: string; svg: string }[] = [];
    const results = await Promise.all(
      matches.map(async ({ code, original }, index) => {
        try {
          const response = await fetch(`${serverUrl}/plantuml/svg`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: code,
          });
          if (!response.ok) { throw new Error(`PlantUML server responded with ${response.status}`); }
          let svg = await response.text();
          svg = svg.replace(/<\?xml[^>]*\?>/, '');
          const id = `plantuml-${index}`;
          diagrams.push({ id, svg });
          return { original, replacement: `<div id="${id}"></div>` };
        } catch (error: any) {
          console.error('PlantUML rendering failed:', error);
          return { original, replacement: `<p>PlantUML Error: ${error.message}</p>` };
        }
      })
    );

    let processedText = text;
    results.forEach(({ original, replacement }) => {
      processedText = processedText.replace(original, replacement);
    });

    return { processedText, diagrams };
  }

  private async processMermaid(text: string, serverUrl: string): Promise<{ processedText: string; diagrams: { id: string; svg: string }[] }> {
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
    const matches: { code: string; original: string }[] = [];
    let match;

    while ((match = mermaidRegex.exec(text)) !== null) {
      matches.push({ code: match[1], original: match[0] });
    }

    if (matches.length === 0) { return { processedText: text, diagrams: [] }; }

    const diagrams: { id: string; svg: string }[] = [];
    const results = await Promise.all(
      matches.map(async ({ code, original }, index) => {
        try {
          const response = await fetch(`${serverUrl}/mermaid/svg`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: code,
          });
          if (!response.ok) { throw new Error(`Mermaid server responded with ${response.status}`); }
          let svg = await response.text();
          svg = svg.replace(/<\?xml[^>]*\?>/, '');
          const id = `mermaid-${index}`;
          diagrams.push({ id, svg });
          return { original, replacement: `<div id="${id}"></div>` };
        } catch (error: any) {
          console.error('Mermaid rendering failed:', error);
          return { original, replacement: `<p>Mermaid Error: ${error.message}</p>` };
        }
      })
    );

    let processedText = text;
    results.forEach(({ original, replacement }) => {
      processedText = processedText.replace(original, replacement);
    });

    return { processedText, diagrams };
  }
}
