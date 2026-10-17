/** Display copies of the core Cypher, shown in the Cypher drawers for judges. Source of truth: packages/core/src/queries/. */
export const QUERIES = {
  conflict: `MATCH p = (f:File {path: $want})-[:IMPORTS*1..3]->(g:File),
      (g)<-[c:CLAIMS]-(o:Agent)
WHERE o.id <> $agent AND c.until > $now
  AND none(n IN nodes(p) WHERE n.hub)
RETURN [n IN nodes(p) | n.path] AS path, length(p) AS hops, o.id AS agent`,
  blast: `MATCH p = (d:File)-[:IMPORTS*1..3]->(f:File {path: $path})
RETURN d.path AS path, min(length(p)) AS hops
ORDER BY hops, path`,
  batches: `CALL algo.WCC({nodeLabels: ['Task'], relationshipTypes: ['INTERFERES']})
YIELD node, componentId
RETURN componentId, collect(node.id) AS tasks`,
};
