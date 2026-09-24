Schauenburg – Die Burgschenke v0.3 FIX

FIX gegenüber v0.2:
- Ursache gefunden: nahezu unsichtbare Alpha-Restpixel außerhalb einiger Objekte
  wurden beim Zuschneiden als Objektfläche gewertet. Dadurch waren Skalierung und
  Positionierung insbesondere bei der Wirtschaft falsch.
- Assets neu am tatsächlich sichtbaren Alpha-Rand getrimmt.
- Positionen/Größen erneut direkt aus Referenzbild 1 abgenommen.
- Cache-Busting ?v=03 für GitHub Pages.
- Stuhl weiterhin hinter Tafel.
- Baum weiterhin ohne Kollision.
- Alpha-genaue Kollision bleibt erhalten.
