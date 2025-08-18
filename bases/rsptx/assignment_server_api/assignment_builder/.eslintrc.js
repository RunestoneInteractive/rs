// .eslintrc.js
module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',            // Path to your tsconfig file
        tsconfigRootDir: __dirname,            // Resolves project relative to this directory
        sourceType: 'module'
    },
    plugins: ['@typescript-eslint'],
    extends: ['plugin:@typescript-eslint/recommended'],
    rules: {
        // your rules here
    }
};