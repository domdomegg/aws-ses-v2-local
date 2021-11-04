# Contributing

PRs are welcomed! To get started developing:
1. Install Node.js and NPM
2. Install dependencies with `npm install`
3. Run `npm run test` to run tests with Jest
4. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:
1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags

GitHub actions will then pick it up and handle the actual publishing to the NPM registry.