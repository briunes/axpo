import { listAllClients } from "../../../../app/internal/lib/internalApi";

describe("listAllClients", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("loads every API page for complete client selectors", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [{ id: "client-1", name: "A Client" }],
              total: 101,
              page: 1,
              pageSize: 100,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [{ id: "client-101", name: "Z Client" }],
              total: 101,
              page: 2,
              pageSize: 100,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const clients = await listAllClients("token", {
      minimal: true,
      orderBy: "name",
      sortDir: "asc",
    });

    expect(clients.map((client) => client.id)).toEqual([
      "client-1",
      "client-101",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("page=1");
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });
});
