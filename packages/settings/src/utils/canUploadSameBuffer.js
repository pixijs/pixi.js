import Device from 'ismobilejs';

/**
 * Uploading the same buffer multiple times in a single frame can cause performance issues.
 * Apparent on iOS so only check for that at the moment
 * This check may become more complex if this issue pops up elsewhere.
 *
 * @returns {boolean}
 */
export default function canUploadSameBuffer()
{
    return !Device.apple.device;
}
