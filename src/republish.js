/**
 * Republish built-in VS Code extensions to npmjs under `@theia/vscode-builtin-` prefix.
 */
// @ts-check
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const { extensions, run } = require('./paths.js');

(async () => {
    await require('./bundle.js');
    const result = [];
    for (const extension of await fs.readdirSync(extensions())) {
        if (extension.startsWith('ms-vscode')) {
            // skip marketplace extensions
            continue;
        }
        const pckPath = extensions(extension, 'package.json');
        if (!fs.existsSync(pckPath)) {
            continue;
        }
        const nodeModulesPath = extensions(extension, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            try {
                await new Promise((resolve, reject) => {
                    try {
                        const nodeModulesZip = fs.createWriteStream(extensions(extension, 'vscode_node_modules.zip'));
                        const archive = archiver('zip');
                        nodeModulesZip.on('close', () => {
                            console.log(archive.pointer() + ' total bytes');
                            console.log('archiver has been finalized and the output file descriptor has closed.');
                            resolve();
                        });
                        archive.on('error', reject);
                        archive.pipe(nodeModulesZip);
                        archive.glob('**', { cwd: nodeModulesPath });
                        archive.finalize();
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                console.error(e);
                continue;
            }
        }
        const originalContent = fs.readFileSync(pckPath, 'utf-8');
        const pck = JSON.parse(originalContent);
        pck.name = '@theia/vscode-builtin-' + pck.name;
        // bump to publish
        pck.version = '0.2.1';

        console.log(pck.name, ': publishing...');
        try {
            fs.writeFileSync(pckPath, JSON.stringify(pck, undefined, 2), 'utf-8');
            await run('yarn', ['publish', '--access', 'public', '--ignore-scripts'], extensions(extension));
            result.push(pck.name + ': sucessfully published');
        } catch (e) {
            result.push(pck.name + ': failed to publish');
            if (e) {
                console.error(e)
            };
        } finally {
            fs.writeFileSync(pckPath, originalContent, 'utf-8');
        }
    }
    console.log(result.join(os.EOL));
})();
