import { TextStyle, TextMetrics, TEXT_GRADIENT } from '@pixi/text';

// TODO: Prevent code duplication b/w generateFillStyle & Text#generateFillStyle

/**
 * Generates the fill style. Can automatically generate a gradient based on the fill style being an array
 *
 * @private
 * @param {object} style - The style.
 * @param {string[]} lines - The lines of text.
 * @return {string|number|CanvasGradient} The fill style
 */
export function generateFillStyle(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    style: TextStyle,
    resolution: number,
    lines: string[],
    metrics: TextMetrics
): string|CanvasGradient|CanvasPattern
{
    // TODO: Can't have different types for getter and setter. The getter shouldn't have the number type as
    //       the setter converts to string. See this thread for more details:
    //       https://github.com/microsoft/TypeScript/issues/2521
    const fillStyle: string|string[]|CanvasGradient|CanvasPattern = style.fill as any;

    if (!Array.isArray(fillStyle))
    {
        return fillStyle;
    }
    else if (fillStyle.length === 1)
    {
        return fillStyle[0];
    }

    // the gradient will be evenly spaced out according to how large the array is.
    // ['#FF0000', '#00FF00', '#0000FF'] would created stops at 0.25, 0.5 and 0.75
    let gradient: string[]|CanvasGradient;

    // a dropshadow will enlarge the canvas and result in the gradient being
    // generated with the incorrect dimensions
    const dropShadowCorrection = (style.dropShadow) ? style.dropShadowDistance : 0;

    // should also take padding into account, padding can offset the gradient
    const padding = style.padding || 0;

    const width = (canvas.width / resolution) - dropShadowCorrection - (padding * 2);
    const height = (canvas.height / resolution) - dropShadowCorrection - (padding * 2);

    // make a copy of the style settings, so we can manipulate them later
    const fill = fillStyle.slice();
    const fillGradientStops = style.fillGradientStops.slice();

    // wanting to evenly distribute the fills. So an array of 4 colours should give fills of 0.25, 0.5 and 0.75
    if (!fillGradientStops.length)
    {
        const lengthPlus1 = fill.length + 1;

        for (let i = 1; i < lengthPlus1; ++i)
        {
            fillGradientStops.push(i / lengthPlus1);
        }
    }

    // stop the bleeding of the last gradient on the line above to the top gradient of the this line
    // by hard defining the first gradient colour at point 0, and last gradient colour at point 1
    fill.unshift(fillStyle[0]);
    fillGradientStops.unshift(0);

    fill.push(fillStyle[fillStyle.length - 1]);
    fillGradientStops.push(1);

    if (style.fillGradientType === TEXT_GRADIENT.LINEAR_VERTICAL)
    {
        // start the gradient at the top center of the canvas, and end at the bottom middle of the canvas
        gradient = context.createLinearGradient(width / 2, padding, width / 2, height + padding);

        // we need to repeat the gradient so that each individual line of text has the same vertical gradient effect
        // ['#FF0000', '#00FF00', '#0000FF'] over 2 lines would create stops at 0.125, 0.25, 0.375, 0.625, 0.75, 0.875

        // There's potential for floating point precision issues at the seams between gradient repeats.
        // The loop below generates the stops in order, so track the last generated one to prevent
        // floating point precision from making us go the teeniest bit backwards, resulting in
        // the first and last colors getting swapped.
        let lastIterationStop = 0;

        // Actual height of the text itself, not counting spacing for lineHeight/leading/dropShadow etc
        const textHeight = metrics.fontProperties.fontSize + style.strokeThickness;

        // textHeight, but as a 0-1 size in global gradient stop space
        const gradStopLineHeight = textHeight / height;

        for (let i = 0; i < lines.length; i++)
        {
            const thisLineTop = metrics.lineHeight * i;

            for (let j = 0; j < fill.length; j++)
            {
                // 0-1 stop point for the current line, multiplied to global space afterwards
                let lineStop = 0;

                if (typeof fillGradientStops[j] === 'number')
                {
                    lineStop = fillGradientStops[j];
                }
                else
                {
                    lineStop = j / fill.length;
                }

                const globalStop = (thisLineTop / height) + (lineStop * gradStopLineHeight);

                // Prevent color stop generation going backwards from floating point imprecision
                let clampedStop = Math.max(lastIterationStop, globalStop);

                clampedStop = Math.min(clampedStop, 1); // Cap at 1 as well for safety's sake to avoid a possible throw.
                gradient.addColorStop(clampedStop, fill[j]);
                lastIterationStop = clampedStop;
            }
        }
    }
    else
    {
        // start the gradient at the center left of the canvas, and end at the center right of the canvas
        gradient = context.createLinearGradient(padding, height / 2, width + padding, height / 2);

        // can just evenly space out the gradients in this case, as multiple lines makes no difference
        // to an even left to right gradient
        const totalIterations = fill.length + 1;
        let currentIteration = 1;

        for (let i = 0; i < fill.length; i++)
        {
            let stop: number;

            if (typeof fillGradientStops[i] === 'number')
            {
                stop = fillGradientStops[i];
            }
            else
            {
                stop = currentIteration / totalIterations;
            }
            gradient.addColorStop(stop, fill[i]);
            currentIteration++;
        }
    }

    return gradient;
}
