/**
 * Remove items from a javascript array without generating garbage
 *
 * @function removeItems
 * @memberof PIXI.utils
 * @param {Array} arr Array to remove elements from
 * @param {number} startIdx starting index
 * @param {number} removeCount how many to remove
 */
export function removeItems(arr, startIdx, removeCount)
{
    const length = arr.length;
    let i;

    if (startIdx >= length || removeCount === 0)
    {
        return;
    }

    removeCount = (startIdx + removeCount > length ? length - startIdx : removeCount);

    const len = length - removeCount;

    for (i = startIdx; i < len; ++i)
    {
        arr[i] = arr[i + removeCount];
    }

    arr.length = len;
}
