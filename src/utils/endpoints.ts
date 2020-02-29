import * as path from 'path';
import * as fs from 'fs';
import {
    IGatsbyEndpoints,
    IConfigTypes,
    IEndpointResolutionSpec,
} from '../types';
import { stringLiteral } from '@babel/types';
import { transformCodeToTemplate } from './babel';
import { checkFileWithExts, fileExists, allExt } from './fs-tools';

// *************************************

export interface IResolveEndpointProps {
    endpointSpecs: IEndpointResolutionSpec[];
    configDir: string;
}

/**
 * This will look in `configDir` for the specified Gatsby endpoints, and
 * return the resolved paths to each
 *
 * @param {IResolveEndpointProps} resolveProps What endpoints to resolve, and from where
 *
 * * `endpointSpecs`: What endpoints to resolve
 * * `configDir`: Where to resolve the endpoints
 * @returns {IGatsbyEndpoints} The resolved endpoints
 */
export const resolveGatsbyEndpoints = ({
    endpointSpecs,
    configDir,
}: IResolveEndpointProps): IGatsbyEndpoints => {
    const resolved: IGatsbyEndpoints = {};

    for (const endpoint of endpointSpecs) {
        const endpointType = typeof endpoint === 'string' ? endpoint : endpoint.type;
        const endpointExt = typeof endpoint === 'string' ? allExt : endpoint.ext;
        const endpointFile = `gatsby-${endpointType}`;
        const configFile = checkFileWithExts(path.join(configDir, endpointFile), endpointExt);
        if (configFile) {
            resolved[endpointType] = configFile;
        }
    }

    return resolved;
};

// ***************************************

export interface IMakeGatsbyEndpointProps {
    resolvedEndpoints: IGatsbyEndpoints;
    distDir: string;
    cacheDir: string;
}
export const browserSsr: IConfigTypes[] = ['browser', 'ssr'];

/**
 * If defined `apiEndpoints` exist in the user's config directory,
 * then copy this plugin's `dist` version to the user's cache directory
 * so that they can proxy the request from this plugin to the user's
 * endpoints.
 *
 * @param {IMakeGatsbyEndpointProps} setupEndpointProps
 *
 * * `resolvedEndpoints`: The collection of endpoints that have been resolved
 * in the user's configuration directory
 * * `distDir`: The location of files that can be copied to this user's cache
 * * `cacheDir`: The location to write the proxy module
 */
export const setupGatsbyEndpoints = ({
    resolvedEndpoints,
    distDir,
    cacheDir,
}: IMakeGatsbyEndpointProps): void => {
    for (const setupApi of browserSsr) {
        const endpointFile = `gatsby-${setupApi}.js`;
        const srcFile = path.join(distDir, endpointFile);
        const targetFile = path.join(cacheDir, endpointFile);

        if (setupApi in resolvedEndpoints) {
            // If User endpoint was resolved, then write out the proxy
            // module that will point to the user's
            const resolvedPath = resolvedEndpoints[setupApi] as string;
            transformCodeToTemplate({
                srcFile,
                targetFile,
                templateSpec: {
                    __TS_CONFIG_ENDPOINT_PATH: stringLiteral(resolvedPath),
                },
            });
        } else {
            // User endpoint was not resolved, so just write an empty module
            fs.writeFileSync(targetFile, `module.exports = {}`);
        }
    }
};