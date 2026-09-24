# Schauenburg – Die Burgschenke v0.2

GitHub-Pages-fertiger Browser-Build.

Neu:
- Wirtschaft, Baum, 3 Stehtische, Tafel und Stuhl integriert.
- Größen und Positionen an Referenzbild 1 ausgerichtet.
- Stuhl liegt eine Render-Ebene hinter der Tafel.
- Wirtschaft, Tische, Tafel und Stuhl besitzen alpha-genaue harte Kollision.
- Baum bleibt ohne Kollision.
- Bestehende 3 Zoomstufen und sanftes Maus-Hover-Panning bleiben erhalten.
- Keine externen Libraries / kein Build-Schritt.

Kollisions-API für die kommende Spielfigur:
- BurgCollision.pointBlocked(x, y)
- BurgCollision.circleBlocked(x, y, radius)
