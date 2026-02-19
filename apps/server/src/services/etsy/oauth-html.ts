const escapeHtml = (input: string): string => {
    return input
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
};

const baseHtml = (title: string, description: string): string => {
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);

    return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${safeTitle}</title>
        <style>
            body {
                font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
                margin: 0;
                background: #0f172a;
                color: #e2e8f0;
                display: grid;
                place-items: center;
                min-height: 100vh;
                padding: 24px;
            }
            main {
                max-width: 560px;
                width: 100%;
                background: #111827;
                border: 1px solid #334155;
                border-radius: 12px;
                padding: 24px;
            }
            h1 {
                margin: 0 0 12px;
                font-size: 20px;
            }
            p {
                margin: 0;
                line-height: 1.5;
                color: #cbd5e1;
            }
        </style>
    </head>
    <body>
        <main>
            <h1>${safeTitle}</h1>
            <p>${safeDescription}</p>
        </main>
        <script>
            if (window.opener && typeof window.opener.postMessage === 'function') {
                window.opener.postMessage(
                    { type: 'etsy-oauth-complete', title: ${JSON.stringify(title)} },
                    '*'
                );
            }
        </script>
    </body>
</html>`;
};

export const renderOAuthSuccessHtml = (): string => {
    return baseHtml(
        'Etsy connected',
        'OAuth completed successfully. Return to EtsySentry to continue.'
    );
};

export const renderOAuthErrorHtml = (message: string): string => {
    return baseHtml('Etsy connection failed', message);
};
