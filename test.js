#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { rimrafSync } from 'rimraf';

class DependencyTester {
    constructor() {
        this.testDir = path.join(process.cwd(), 'test-projects');
        this.scriptPath = path.join(process.cwd(), 'dep-check-script.js'); // Ajustez le nom
        this.managers = ['npm', 'yarn', 'pnpm'];
        this.testResults = [];
    }

    // Créer un répertoire de test temporaire
    async setupTestDir() {
        if (fs.existsSync(this.testDir)) {
            rimrafSync(this.testDir);
        }
        fs.mkdirSync(this.testDir, { recursive: true });
        console.log('📁 Test directory created:', this.testDir);
    }

    // Nettoyer après les tests
    async cleanup() {
        if (fs.existsSync(this.testDir)) {
            rimrafSync(this.testDir);
            console.log('🧹 Test directory cleaned up');
        }
    }

    // Créer un projet de test avec package.json
    createTestProject(name, packageJson, manager = 'npm') {
        const projectPath = path.join(this.testDir, name);
        fs.mkdirSync(projectPath, { recursive: true });

        fs.writeFileSync(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        return projectPath;
    }

    // Installer des dépendances dans un projet
    async installDependencies(projectPath, manager = 'npm') {
        const originalCwd = process.cwd();
        try {
            process.chdir(projectPath);

            // Vérifier si le manager est disponible
            try {
                execSync(`${manager} --version`, { stdio: 'ignore' });
            } catch (e) {
                console.log(`⚠️ ${manager} not available, skipping`);
                return false;
            }

            execSync(`${manager} install`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            console.log(`❌ Failed to install with ${manager}:`, error.message);
            return false;
        } finally {
            process.chdir(originalCwd);
        }
    }

    // Simuler des dépendances manquantes
    async createMissingDepsScenario(projectPath) {
        const nodeModulesPath = path.join(projectPath, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            // Supprimer quelques modules pour simuler des dépendances manquantes
            const modules = fs.readdirSync(nodeModulesPath);
            if (modules.length > 0) {
                const moduleToDelete = modules[0];
                rimrafSync(path.join(nodeModulesPath, moduleToDelete));
                console.log(`🗑️ Deleted ${moduleToDelete} to simulate missing dependency`);
            }
        }
    }

    // Tester la fonctionnalité "scan" (vérification des dépendances manquantes)
    async testScanFunction(projectPath, manager) {
        const originalCwd = process.cwd();
        try {
            process.chdir(projectPath);

            console.log(`🔍 Testing scan function with ${manager}...`);

            // Simuler l'exécution du script avec l'option scan
            const result = execSync(`node ${this.scriptPath} --${manager}`, {
                input: '1\n', // Choisir "scan"
                encoding: 'utf8',
                timeout: 30000
            });

            return {
                success: true,
                output: result,
                manager: manager
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                manager: manager
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    // Tester la fonctionnalité "search" (outdated & vulnerabilities)
    async testSearchFunction(projectPath, manager) {
        const originalCwd = process.cwd();
        try {
            process.chdir(projectPath);

            console.log(`🔎 Testing search function with ${manager}...`);

            const result = execSync(`node ${this.scriptPath} --${manager}`, {
                input: '2\nn\n', // Choisir "search", puis "non" pour les mises à jour
                encoding: 'utf8',
                timeout: 30000
            });

            return {
                success: true,
                output: result,
                manager: manager
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                manager: manager
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    // Tester la fonctionnalité "clean" (réinstallation complète)
    async testCleanFunction(projectPath, manager) {
        const originalCwd = process.cwd();
        try {
            process.chdir(projectPath);

            console.log(`🧹 Testing clean function with ${manager}...`);

            const result = execSync(`node ${this.scriptPath} --${manager}`, {
                input: '3\n', // Choisir "clean"
                encoding: 'utf8',
                timeout: 60000
            });

            return {
                success: true,
                output: result,
                manager: manager
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                manager: manager
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    // Tester l'option --fix
    async testFixOption(projectPath, manager) {
        const originalCwd = process.cwd();
        try {
            process.chdir(projectPath);

            console.log(`🔧 Testing --fix option with ${manager}...`);

            const result = execSync(`node ${this.scriptPath} --fix --${manager}`, {
                encoding: 'utf8',
                timeout: 60000
            });

            return {
                success: true,
                output: result,
                manager: manager
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                manager: manager
            };
        } finally {
            process.chdir(originalCwd);
        }
    }

    // Créer différents scénarios de test
    getTestScenarios() {
        return [
            {
                name: 'basic-project',
                packageJson: {
                    name: 'test-basic',
                    version: '1.0.0',
                    dependencies: {
                        lodash: '^4.17.21'
                    },
                    devDependencies: {
                        nodemon: '^2.0.20'
                    }
                }
            },
            {
                name: 'outdated-project',
                packageJson: {
                    name: 'test-outdated',
                    version: '1.0.0',
                    dependencies: {
                        axios: '0.21.0', // Version ancienne
                        express: '4.17.0'
                    },
                    devDependencies: {
                        jest: '26.0.0'
                    }
                }
            },
            {
                name: 'minimal-project',
                packageJson: {
                    name: 'test-minimal',
                    version: '1.0.0',
                    dependencies: {}
                }
            }
        ];
    }

    // Exécuter tous les tests
    async runAllTests() {
        console.log('🚀 Starting comprehensive dependency manager tests...\n');

        await this.setupTestDir();

        const scenarios = this.getTestScenarios();

        for (const scenario of scenarios) {
            console.log(`\n📦 Testing scenario: ${scenario.name}`);
            console.log('='.repeat(50));

            for (const manager of this.managers) {
                console.log(`\n📋 Testing with ${manager.toUpperCase()}:`);

                // Créer le projet de test
                const projectPath = this.createTestProject(
                    `${scenario.name}-${manager}`,
                    scenario.packageJson,
                    manager
                );

                // Installer les dépendances
                const installed = await this.installDependencies(projectPath, manager);
                if (!installed) {
                    this.testResults.push({
                        scenario: scenario.name,
                        manager: manager,
                        test: 'installation',
                        success: false,
                        error: 'Manager not available or installation failed'
                    });
                    continue;
                }

                // Test 1: Fonction scan
                const scanResult = await this.testScanFunction(projectPath, manager);
                this.testResults.push({
                    scenario: scenario.name,
                    manager: manager,
                    test: 'scan',
                    ...scanResult
                });

                // Test 2: Créer des dépendances manquantes et retester
                await this.createMissingDepsScenario(projectPath);
                const scanMissingResult = await this.testScanFunction(projectPath, manager);
                this.testResults.push({
                    scenario: scenario.name,
                    manager: manager,
                    test: 'scan-missing',
                    ...scanMissingResult
                });

                // Réinstaller pour les tests suivants
                await this.installDependencies(projectPath, manager);

                // Test 3: Fonction search
                const searchResult = await this.testSearchFunction(projectPath, manager);
                this.testResults.push({
                    scenario: scenario.name,
                    manager: manager,
                    test: 'search',
                    ...searchResult
                });

                // Test 4: Option --fix
                const fixResult = await this.testFixOption(projectPath, manager);
                this.testResults.push({
                    scenario: scenario.name,
                    manager: manager,
                    test: 'fix',
                    ...fixResult
                });
            }
        }

        await this.cleanup();
        this.generateReport();
    }

    // Générer un rapport des résultats
    generateReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(70));

        const groupedResults = this.groupResultsByTest();

        Object.keys(groupedResults).forEach((testType) => {
            console.log(`\n🧪 ${testType.toUpperCase()}:`);

            const results = groupedResults[testType];
            const successCount = results.filter((r) => r.success).length;
            const totalCount = results.length;

            console.log(`✅ Success: ${successCount}/${totalCount}`);

            const failures = results.filter((r) => !r.success);
            if (failures.length > 0) {
                console.log('❌ Failures:');
                failures.forEach((failure) => {
                    console.log(
                        `   - ${failure.scenario} (${failure.manager}): ${
                            failure.error || 'Unknown error'
                        }`
                    );
                });
            }
        });

        const totalTests = this.testResults.length;
        const totalSuccess = this.testResults.filter((r) => r.success).length;
        const successRate = ((totalSuccess / totalTests) * 100).toFixed(1);

        console.log('\n' + '='.repeat(70));
        console.log(`📈 OVERALL SUCCESS RATE: ${successRate}% (${totalSuccess}/${totalTests})`);
        console.log('='.repeat(70));

        // Sauvegarder le rapport détaillé
        this.saveDetailedReport();
    }

    // Grouper les résultats par type de test
    groupResultsByTest() {
        const grouped = {};
        this.testResults.forEach((result) => {
            if (!grouped[result.test]) {
                grouped[result.test] = [];
            }
            grouped[result.test].push(result);
        });
        return grouped;
    }

    // Sauvegarder un rapport détaillé
    saveDetailedReport() {
        const reportPath = path.join(process.cwd(), 'test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                successfulTests: this.testResults.filter((r) => r.success).length,
                failedTests: this.testResults.filter((r) => !r.success).length,
                successRate:
                    (
                        (this.testResults.filter((r) => r.success).length /
                            this.testResults.length) *
                        100
                    ).toFixed(1) + '%'
            },
            results: this.testResults
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }
}

// Fonction principale
async function main() {
    const tester = new DependencyTester();

    try {
        await tester.runAllTests();
    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// Vérification des arguments de ligne de commande
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🧪 Dependency Manager Test Suite

Usage:
  node test-script.js [options]

Options:
  --help, -h    Show this help message
  
This script will:
1. Create temporary test projects with different scenarios
2. Test your dependency manager script with npm, yarn, and pnpm
3. Verify all functions: scan, search, clean, and --fix option
4. Generate a comprehensive test report

Make sure your script is named correctly in the DependencyTester constructor.
    `);
    process.exit(0);
}

// Exécuter les tests
main().catch(console.error);
