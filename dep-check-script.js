#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import { rimrafSync } from 'rimraf';

const program = new Command();

program
    .option(
        '--fix',
        'dependency problem. Delete node_modules & package-lock.json, and reinstall everything'
    )
    .option('--npm', 'use npm')
    .option('--yarn', 'use yarn')
    .option('--pnpm', 'use pnpm');
program.parse(process.argv);
const options = program.opts();

let manager = '';
if (options.npm) manager = 'npm';
else if (options.yarn) manager = 'yarn';
else if (options.pnpm) manager = 'pnpm';

// Q - what do you want to do ?
async function main() {
    if (options.fix) {
        cleanSlate();
        return;
    }

    const objective = await inquirer.prompt([
        {
            type: 'list',
            name: 'SSC',
            message: 'what do you want this script to do ? ',
            choices: [
                { name: 'check if there is any dependency missing', value: 'scan' },
                { name: 'search for outdated & vulnerabilities', value: 'search' },
                { name: 'something is wrong, reinstall everything', value: 'clean' }
            ]
        }
    ]);
    switch (objective.SSC) {
        case 'scan':
            await isDepMissing();
            break;
        case 'search':
            await analyseDep();
            break;
        case 'clean':
            await cleanSlate();
            break;
    }
}

await main();

// 1 - scan pr diff entre installed and declared
async function isDepMissing() {
    if (!manager) {
        const whichManager = await inquirer.prompt([
            {
                type: 'list',
                name: 'pickManager',
                message: 'which one is your manager ?',
                choices: ['npm', 'yarn', 'pnpm']
            }
        ]);
        manager = whichManager.pickManager;
    }

    let stdout;
    if (manager === 'npm') {
        stdout = execSync('npm ls --parseable', { encoding: 'utf8' });
    } else {
        stdout = execSync(`${manager} list`, { encoding: 'utf8' });
    }
    const installedDep = stdout
        .split('\n')
        .filter((l) => l.includes('node_modules'))
        .map((l) => l.split('node_modules/').pop());

    const depList = searchForPackageJSONInfo();
    if (depList.length === installedDep.length) {
        console.log('nothing is missing, the problem lies elsewhere, good luck !');
        return;
    }

    await cleanSlate();

    return;
}
// 2 - scan pr  outdated & vulnerabilities
async function analyseDep() {
    try {
        if (!manager) {
            const whichManager = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'pickManager',
                    message: 'which one is your manager ?',
                    choices: ['npm', 'yarn', 'pnpm']
                }
            ]);
            manager = whichManager.pickManager;
        }
        // 2.1 - get versions with npm outdated
        const outdatedList = await getVersions();
        let updateToWanted = { wantToUpdate: false };
        if (outdatedList.length === 0) console.log('no outdated version');
        else {
            console.table(outdatedList);
            updateToWanted = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'wantToUpdate',
                    message: 'do you want to update all dependencies to "wanted " ? Y/N '
                }
            ]);
        }
        // 2.2 - parse json with npm audit --json to get vulnerabilities
        if (updateToWanted.wantToUpdate) {
            const listDep = await getPackageJSONInfo();

            await updateOutdated(
                // TODO : ici si pas de devDep on est pas coincé ??
                Object.keys(listDep.devDependencies || {}),
                Object.keys(listDep.dependencies || {}),
                outdatedList
            );
        }
        const vulnerabilitiesList = await getVulnerabilities();
        if (vulnerabilitiesList.length === 0) {
            console.log('no need for this script, good coding !');
            return;
        }
        // 2.3 - show results in table
        // 2.4 - want to update to latest or 1st safe?
        await updateVulDep(vulnerabilitiesList);
    } catch (err) {
        console.log('error :', err);
    }
}
async function getVersions() {
    try {
        let outdatedDepList = [];
        const stdout = execSync(`${manager} outdated --json`);
        if (manager === 'yarn') {
            const results = stdout.split('\n').filter(Boolean).map(JSON.parse);
            results.forEach(({ type, data }) => {
                if (type === 'table') {
                    data.body.forEach((dep) => {
                        outdatedDepList.push({
                            name: dep[0],
                            current: dep[1],
                            wanted: dep[2],
                            latest: dep[3],
                            type: dep[4]
                        });
                    });
                }
            });
        } else {
            // npm et pnpm
            const cleanResults = JSON.parse(stdout);
            for (const [name, info] of Object.entries(cleanResults)) {
                if (info.current !== info.wanted) {
                    outdatedDepList.push({
                        name: name,
                        current: info.current,
                        wanted: info.wanted,
                        latest: info.latest,
                        type: info.dependencyType
                    });
                }
            }
        }
        return outdatedDepList;
    } catch (err) {
        console.log('error :', err);
        return outdatedDepList;
    }
}
async function updateOutdated(devDeps, deps, outdated) {
    const installCmd = manager === 'npm' ? 'install' : 'add';
    const mode = 'wanted';

    for (const dep of outdated) {
        let flag = '';
        if (devDeps.includes(dep.name)) {
            flag = manager === 'npm' ? '--save-dev' : manager === 'yarn' ? '--dev' : '-D';
        } else if (!deps.includes(dep.name)) {
            console.log(`${dep.name} is not a direct dependency, skipping.`);
            continue;
        }

        const version = mode === 'wanted' ? dep.wanted : dep.latest;
        const cmd = `${manager} ${installCmd} ${dep.name}@${version} ${flag}`.trim();

        console.log(`Running: ${cmd}`);

        try {
            const { stdout, stderr } = execSync(cmd);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (err) {
            console.error(`Error updating ${dep.name}:`, err.message);
        }
    }
}
function extractVersion(str) {
    const match = str.match(/\b(\d+\.\d+\.\d+)\b/);
    return match ? match[1] : null;
}
function organisedResults(stdout) {
    let arrayResult = [];
    const cleanResults = JSON.parse(stdout).vulnerabilities;
    for (const [name, vuln] of Object.entries(cleanResults)) {
        arrayResult.push({
            name,
            severity: vuln.severity,
            fix: vuln.fixAvailable?.version || null
        });
    }
    return arrayResult;
}
async function getVulnerabilities() {
    try {
        if (manager === 'pnpm') {
            const wantInstall = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'doyouwantaudit',
                    message:
                        "audit isn't there by default, do you accept that I install pnpm audit ? ? y/N",
                    default: false
                }
            ]);
            if (!wantInstall.doyouwantaudit) {
                console.log('nothing installed, no vulnerabilities found');
                return [];
            }
            try {
                execSync('pnpm add -D @pnpm/audit', { stdio: 'inherit' });
            } catch (err) {
                console.log('error while trying to install pnpm audit : ', err);
                return [];
            }
            try {
                const stdout = execSync(`${manager} audit --json`);
                return organisedResults(stdout);
            } catch (err) {
                console.log('error trying to get vulnerabilities : ', err);
                return [];
            }
        } else if (manager === 'npm') {
            try {
                const stdout = execSync(`${manager} audit --json`);
                return organisedResults(stdout);
            } catch (err) {
                console.log('error trying to get vulnerabilities : ', err);
                return [];
            }
        } else {
            try {
                let cleanResults = [];
                const stdout = execSync(`${manager} audit --json`);
                const listResults = stdout.split('\n').filter(Boolean).map(JSON.parse);
                const arrayResults = listResults.auditAdvisory.data.advisory;
                arrayResults.forEach((vul) => {
                    cleanResults.push({
                        name: vul.module_name,
                        severity: vul.severity,
                        fix: extractVersion(vul.recommendation)
                    });
                });
                return cleanResults;
            } catch (err) {
                console.log('error trying to get vulnerabilities : ', err);
                return [];
            }
        }
    } catch (err) {
        console.log('error trying to get vulnerabilities : ', err);
    }
}
function getPackageJSONInfo() {
    const ROOT_DIR = process.cwd();
    if (fs.existsSync(`${ROOT_DIR}/package.json`)) {
        return JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    } else {
        console.log("didn't find the packeage.json there:", ROOT_DIR);
        return [];
    }
}
async function patchVulnerabilities(devDeps, deps, vulnerabilities, mode) {
    for (const vuln of vulnerabilities) {
        let flag = '';
        let version = mode === 'fix' ? vuln.fix : 'latest';

        if (devDeps.includes(vuln.name)) {
            flag = manager === 'npm' ? '--save-dev' : manager === 'yarn' ? '--dev' : '-D';
        } else if (!deps.includes(vuln.name)) {
            if (mode === 'fix') {
                console.log(
                    `${vuln.name} is an indirect dependency, cannot patch directly (skip).`
                );
                continue;
            } else {
                console.log(
                    `${vuln.name} is an indirect dependency, you must wait for its parent to update.`
                );
            }
        }
        const installCmd = manager === 'npm' ? 'install' : 'add';
        const cmd = `${manager} ${installCmd} ${vuln.name}@${version} ${flag}`.trim();
        console.log(`Running: ${cmd}`);

        try {
            const stdout = execSync(cmd);
        } catch (err) {
            console.error(`Error updating ${vuln.name}:`, err.message);
        }
    }
}
async function updateVulDep(vulnerabilitiesList) {
    const nextStep = await inquirer.prompt([
        {
            type: 'list',
            name: 'whatsnext',
            message: 'what do you want to do for the vulnerabilities : ',
            choices: [
                { name: 'upgrade to latest version', value: 'latest' },
                { name: 'upgrade to fix only', value: 'fix' },
                { name: 'ignore', value: 'ignore' }
            ]
        }
    ]);
    if (nextStep.whatsnext === 'ignore') {
        console.log('all right, end of script');
        return;
    }
    const listDep = await getPackageJSONInfo();
    const devDepList = Object.keys(listDep.devDependencies || {});
    const depList = Object.keys(listDep.dependencies || {});
    patchVulnerabilities(devDepList, depList, vulnerabilitiesList, nextStep.whatsnext);
}
// 3 - reinstall everything
async function cleanSlate() {
    // 3.1 - del  node_module & package-lock.json
    if (!(await deleteall())) return;
    // 3.2 - reinstall all
    if (!(await reinstAll())) return;
    // 3.3 - check if done correctly
    if (await compareDep()) {
        console.log("All good, you're good to go");
    }
}
async function deleteall() {
    try {
        rimrafSync('node_modules');
        rimrafSync('package-lock.json');
        console.log('node_modules & package-lock.json deleted');
        return true;
    } catch (error) {
        console.log('error while deleting node-module & package-lock.json', error);
        return false;
    }
}
async function reinstAll() {
    if (!manager) {
        const whichManager = await inquirer.prompt([
            {
                type: 'list',
                name: 'pickManager',
                message: 'which one is your manager ?',
                choices: ['npm', 'yarn', 'pnpm']
            }
        ]);

        manager = whichManager.pickManager;
    }

    try {
        execSync(`${manager} install`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.log('error trying to reinstall all dependencies : ', error);
        return false;
    }
}
function searchForPackageJSONInfo() {
    const ROOT_DIR = process.cwd();
    if (fs.existsSync(`${ROOT_DIR}/package.json`)) {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        return [...dependencies, ...devDependencies];
    } else {
        console.log("didn't find the file there:", ROOT_DIR);
        return [];
    }
}
async function compareDep() {
    // get all dep installed
    try {
        let stdout;
        if (manager === 'npm') {
            stdout = execSync('npm ls --parseable', { encoding: 'utf8' });
        } else {
            stdout = execSync(`${manager} list`, { encoding: 'utf8' });
        }

        const installedDep = stdout
            .split('\n')
            .filter((l) => l.includes('node_modules'))
            .map((l) => l.split('node_modules/').pop());

        const depList = searchForPackageJSONInfo();
        if (depList.length != installedDep.length) console.log('error, something is missing');

        const missing = depList.filter((dep) => !installedDep.includes(dep));

        if (missing.length === 0) {
            return true;
        } else {
            console.log('Missing dependencies:', missing);
            return false;
        }
    } catch (error) {
        console.log('error while getting all installed dependencies : ', error);
        return false;
    }
}
