import fs from 'fs-extra';
import path from 'path';

export default function generateSetsPlugin() {
    return {
        name: 'generate-sets-manifest',
        buildStart() {
            const setsDir = path.resolve(process.cwd(), 'public/sets');
            const manifestPath = path.resolve(setsDir, 'index.json');

            try {
                if (fs.existsSync(setsDir)) {
                    const subDirs = ['Kanji', 'English'];
                    let allSets = [];

                    subDirs.forEach(type => {
                        const dirPath = path.join(setsDir, type);
                        if (fs.existsSync(dirPath)) {
                            const files = fs.readdirSync(dirPath);
                            const csvFiles = files.filter(f => f.endsWith('.csv'));

                            const sets = csvFiles.map(file => {
                                const name = file.replace('.csv', '');
                                const id = `static-set-${type.toLowerCase()}-${Buffer.from(name).toString('base64').substring(0, 10)}`;
                                return { id, name, filename: `${type}/${file}`, type: type };
                            });
                            allSets = [...allSets, ...sets];
                        }
                    });

                    fs.writeJsonSync(manifestPath, { sets: allSets }, { spaces: 2 });
                    console.log(`[generate-sets-manifest] Created index.json with ${allSets.length} sets from public/sets/`);
                }
            } catch (error) {
                console.error('[generate-sets-manifest] Error generating index.json:', error);
            }
        },
        handleHotUpdate({ file, server }) {
            if (file.includes('public/sets') && file.endsWith('.csv')) {
                const setsDir = path.resolve(process.cwd(), 'public/sets');
                const manifestPath = path.resolve(setsDir, 'index.json');

                const subDirs = ['Kanji', 'English'];
                let allSets = [];

                subDirs.forEach(type => {
                    const dirPath = path.join(setsDir, type);
                    if (fs.existsSync(dirPath)) {
                        const files = fs.readdirSync(dirPath);
                        const csvFiles = files.filter(f => f.endsWith('.csv'));

                        const sets = csvFiles.map(f => {
                            const name = f.replace('.csv', '');
                            const id = `static-set-${type.toLowerCase()}-${Buffer.from(name).toString('base64').substring(0, 10)}`;
                            return { id, name, filename: `${type}/${f}`, type: type };
                        });
                        allSets = [...allSets, ...sets];
                    }
                });
                fs.writeJsonSync(manifestPath, { sets: allSets }, { spaces: 2 });
                console.log(`[generate-sets-manifest] Updated index.json`);
            }
        }
    };
}
