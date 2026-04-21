// babel.config.js
// Scoped to Jest only. Next.js uses its own SWC pipeline for `next build`
// and will ignore this config unless SWC is explicitly disabled. The `test`
// environment check keeps the transform out of the Next build path.

module.exports = (api) => {
    const isTest = api.env('test');
    if (!isTest) return {};
    return {
          presets: [
                  ['@babel/preset-env', { targets: { node: 'current' } }],
                ],
    };
};
