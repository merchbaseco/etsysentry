import { describe, expect, test } from 'bun:test';
import { renderOAuthErrorHtml } from './oauth-html';

describe('oauth-html', () => {
    test('escapes untrusted error content', () => {
        const html = renderOAuthErrorHtml('<script>alert("boom")</script>');

        expect(html).toContain('&lt;script&gt;alert(&quot;boom&quot;)&lt;/script&gt;');
        expect(html).not.toContain('<script>alert("boom")</script>');
    });
});
