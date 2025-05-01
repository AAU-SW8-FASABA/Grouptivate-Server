import cron from "node-cron";

import GroupModel from "../models/GroupModel";
import GoalModel from "../models/GoalModel";
import { Interval } from "../../Grouptivate-API/schemas/Interval";

export async function updateStreaks(interval: Interval) {
	const groups = await GroupModel.find({
		interval,
	});

	await Promise.all(
		groups.map(async (group) => {
			const goals = await GoalModel.find({
				_id: { $in: group.goalIds },
			});

			const succeeded = goals.every((goal) => {
				const total = Array.from(goal.progress).reduce(
					(acc, curr) => acc + curr[1],
					0,
				);
				return total >= goal.target;
			});

			if (goals.length > 0 && succeeded) {
				group.streak += 1;
			} else {
				group.streak = 0;
			}

			await group.save();

			await Promise.all(
				goals.map(async (goal) => {
					for (const key of goal.progress.keys()) {
						goal.progress.set(key, 0);
					}

					await goal.save();
				}),
			);
		}),
	);
}

export default function configureStreakJobs() {
	// Daily
	cron.schedule("0 0 * * *", async () => {
		await updateStreaks(Interval.Daily);
	});

	// Weekly
	cron.schedule("0 0 * * 1", async () => {
		await updateStreaks(Interval.Weekly);
	});

	// Monthly
	cron.schedule("0 0 1 * *", async () => {
		await updateStreaks(Interval.Monthly);
	});
}
