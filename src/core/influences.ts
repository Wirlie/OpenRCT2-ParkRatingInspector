import { Effect } from "./effects";
import { ParkInfo } from "./parkInfo";

/**
 * Callback for something that can influence a park rating.
 * @returns True if the record was updated, false if not.
 */
type Influence = (current: Effect, park: ParkInfo) => boolean;


/**
 * All influences that can be applied to a currently stored effect.
 * All influences returns true if the effect has changed, or false
 * if it's still the same.
 */
export const Influences: Record<string, Influence> =
{
	/**
	 * The initial starting park rating applied to every park.
	 */
	/*base()
	{
		// Internally 1150, but...
		//   -150 to include total number of guests penalty;
		//   -500 to include happy guests penalty;
		//   -300 to include base ride penalties;
		//   -200 to include ride total rating penalties;
		return [0, "Initial base park rating (starting point)"];
	},*/

	/**
	 * Penalty for parks with the 'difficult park rating' flag.
	 */
	difficulty(current: Effect, park: ParkInfo): boolean
	{
		if (current.active === park.hasDifficultParkRating)
			return false;

		current.active = park.hasDifficultParkRating;
		if (current.active)
		{
			current.impact = -100;
			current.name = "Dificultad";
			current.value = "enabled";
			current.maximum = null;
			current.note = "Configuración para 'calificación de parque difícil'";
		}
		return true;
	},

	/**
	 * The more guests there are, the higher the park rating.
	 */
	numberOfGuests(current: Effect, park: ParkInfo)
	{
		const guestCount = park.guests.total;
		if (guestCount === current.cache)
			return false; // same as cache, no update

		current.cache = guestCount;
		current.active = true;
		current.impact = Math.floor(Math.min(2000, guestCount) / 13);
		current.name = "Invitados";
		current.value = `${guestCount}/2000`;
		current.maximum = 153;
		current.note = "+1 por cada 13 invitados, máx. +153";
		return true;
	},

	/**
	 * Rewards the player for whatever percentage of guests are happy, up to 83%.
	 */
	numberOfHappyGuests(current: Effect, park: ParkInfo)
	{
		const totalGuests = park.guests.total;
		if (totalGuests <= 0)
			return disableEffect(current);

		const happyGuests = park.guests.happy;
		const hash = (totalGuests ^ happyGuests);

		if (hash === current.cache)
			return false; // same as cache, no update

		current.cache = hash;
		current.active = true;
		current.impact = Math.floor(2 * Math.min(250, (happyGuests * 300) / totalGuests));

		const percentage = Math.floor((happyGuests / totalGuests) * 100);
		current.name = "Invitados felices";
		current.value = `${happyGuests}/${totalGuests} (${percentage}%)`;
		current.maximum = 500;
		current.note = "+6 por cada porcentaje, máx. +500 (83%)";
		return true;
	},

	/**
	 * Penalizes the player for every lost guest after the first 25 guests who are lost.
	 */
	numberOfLostGuests(current: Effect, park: ParkInfo)
	{
		const lostGuests = park.guests.lost;
		if (lostGuests === current.cache)
			return false; // same as cache, no update

		current.cache = lostGuests;
		current.active = true;
		current.impact = (lostGuests > 25) ? ((lostGuests - 25) * -7) : 0;
		current.name = "Invitados perdidos";
		current.value = `${lostGuests}`;
		current.maximum = null;
		current.note = "-7 por cada invitado perdido después de los primeros 25";
		return true;
	},

	/**
	 * Rewards the player for not having broken rides.
	 */
	rideUptime(current: Effect, park: ParkInfo)
	{
		const rideCount = park.rides.total;
		if (rideCount <= 0)
			return disableEffect(current);

		const totalUptime = park.rides.uptime;
		if (totalUptime === current.cache)
			return false;

		current.cache = totalUptime;
		current.active = true;

		const averageUptime = Math.floor(totalUptime / rideCount);
		current.impact = (averageUptime * 2);
		current.name = "Tiempo actividad promedio atracción";
		current.value = `${averageUptime}%`;
		current.maximum = 200;
		current.note = "+2 por cada porciento, máx. +200";
		return true;
	},

	/**
	 * Penalizes the player if they only have gentle rides, or only have rides with really high excitement.
	 */
	rideAverageExcitement(current: Effect, park: ParkInfo)
	{
		const withRatings = park.rides.withRatings;
		if (withRatings <= 0)
			return disableEffect(current);

		const averageExcitement = (park.rides.excitement / withRatings);
		if (averageExcitement === current.cache)
			return false;

		current.cache = averageExcitement;
		current.active = true;
		current.impact = getAverageRatingImpact(averageExcitement, 46);
		current.name = "Emoción de atracción promedio";
		current.value = `${(averageExcitement * 0.08).toFixed(2)}/3.68`;
		current.maximum = 50;
		current.note = "Más cerca es mejor, máx. +50";
		return true;
	},

	/**
	 * Penalizes the player if they only have gentle rides, or only have rides with really high intensity.
	 */
	rideAverageIntensity(current: Effect, park: ParkInfo)
	{
		const withRatings = park.rides.withRatings;
		if (withRatings <= 0)
			return disableEffect(current);

		const averageIntensity = (park.rides.intensity / withRatings);
		if (averageIntensity === current.cache)
			return false;

		current.cache = averageIntensity;
		current.active = true;
		current.impact = getAverageRatingImpact(averageIntensity, 65);
		current.name = "Intensidad de atracción promedio";
		current.value = `${(averageIntensity * 0.08).toFixed(2)}/5.20`;
		current.maximum = 50;
		current.note = "Más cerca es mejor, máx. +50";
		return true;
	},

	/**
	 * Rewards the player for owning rides that are exciting.
	 */
	rideTotalExcitement(current: Effect, park: ParkInfo)
	{
		const totalExcitement = park.rides.excitement;
		if (totalExcitement === current.cache)
			return false;

		current.cache = totalExcitement;
		current.active = true;
		current.impact = Math.floor(Math.min(totalExcitement, 1000) / 10);
		current.name = "Emoción total de atracciones";
		current.value = `${(totalExcitement * 0.08).toFixed(1)}/80.0`;
		current.maximum = 100;
		current.note = "Máx. +100";
		return true;
	},

	/**
	 * Rewards the player for owning rides that are intense.
	 */
	rideTotalIntensity(current: Effect, park: ParkInfo)
	{
		const totalIntensity = park.rides.intensity;
		if (totalIntensity === current.cache)
			return false;

		current.cache = totalIntensity;
		current.active = true;
		current.impact = Math.floor(Math.min(totalIntensity, 1000) / 10);
		current.name = "Intensidad total de atracciones";
		current.value = `${(totalIntensity * 0.08).toFixed(1)}/80.0`;
		current.maximum = 100;
		current.note = "Máx. +100";
		return true;
	},

	/**
	 * Penalizes the player for every piece of litter in the park.
	 */
	litter(current: Effect, park: ParkInfo)
	{
		const litterCount = park.litter;
		if (litterCount === current.cache)
			return false;

		current.cache = litterCount;
		current.active = true;
		current.impact = (-4 * Math.min(150, litterCount));
		current.name = "Cantidad de basura";
		current.value = `${litterCount}/150`;
		current.maximum = null;
		current.note = "-4 por pieza de basura mayor a 3 minutos";
		return true;
	},

	/**
	 * Amount of penalty points from crashed vehicles and recently dead guests.
	 */
	casualties(current: Effect, park: ParkInfo)
	{
		const effect = park.casualtyPenalty;
		if (effect === current.cache)
			return false;

		current.cache = effect;
		current.active = true;
		current.impact = -effect;
		current.name = "Penalización casual";
		current.value = `${effect}/1000`;
		current.maximum = null;
		current.note = "-200 por tren accidentado hasta -500, -25 por invitado ahogado";
		return true;
	}
};


/**
 * Calculates the impact from the distance between the average rating and the
 * target average.
 */
function getAverageRatingImpact(average: number, target: number): number
{
	let impact = (average - target);
	if (impact < 0)
		impact = -impact;

	return (50 - Math.min(Math.floor(impact / 2), 50));
}


/**
 * Sets the effect to inactive, sets the cache to 0.
 * @returns True if the effect has been deactivated, or false if the effect was already inactive.
 */
function disableEffect(effect: Effect): boolean
{
	if (effect.active)
	{
		effect.cache = 0;
		effect.active = false;
		return true;
	}
	return false;
}
