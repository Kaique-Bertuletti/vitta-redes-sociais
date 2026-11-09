export async function GET() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const id = process.env.INSTAGRAM_ACCOUNT_ID;

  const url =
    `https://graph.facebook.com/v27.0/${id}/insights` +
    `?metric=reach,views,accounts_engaged,total_interactions` +
    `&metric_type=total_value&period=day&access_token=${token}`;

  const res = await fetch(url, { cache: "no-store" });
  return Response.json(await res.json());
}
