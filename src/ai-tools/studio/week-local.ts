import { bodyLongitude, longitudeSpeed } from '../../lib/engine/full';
import { scanYourWeek, type WeekRequest, type YourWeek } from './week';

/** The week on the bundled engine; the worker runs this, and so does the panel when a host refuses workers. */
export const computeYourWeek = (request: WeekRequest): YourWeek => scanYourWeek(request, { bodyLongitude, longitudeSpeed });
