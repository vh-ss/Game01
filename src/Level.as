package  
{
	import flash.utils.ByteArray;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Tilemap;
	import net.flashpunk.masks.Grid;
	import net.flashpunk.FP;
	
	/**
	 * ...
	 * @author vadim
	 */
	public class Level extends Entity 
	{
		private var _tiles:Tilemap;
		private var _grid:Grid;
		public var levelData:XML;
		[Embed(source = '../assets/graphics/tilemap.png')] public const SPRITE_TILESET:Class;
		public function Level(xml:Class) 
		{
			
			_tiles = new Tilemap(SPRITE_TILESET, Assets.GAMEWIDTH,Assets.GAMEHEIGHT, 32, 32);
			graphic = _tiles;
			layer = 1;
			_grid = new Grid(Assets.GAMEWIDTH,Assets.GAMEHEIGHT, 32, 32, 0, 0);
			mask = _grid;
			type = "level";
			loadLevel(xml);
		}
		
		private function loadLevel(xml:Class):void 
		{
			var rawData:ByteArray = new xml;
			var dataString:String = rawData.readUTFBytes(rawData.length);
			levelData = new XML(dataString);
			
			var dataList:XMLList;
			var dataElement:XML;
			
			
			dataList = levelData.OurTiles.tile;
			
			for each (dataElement in dataList)
			{
				_tiles.setTile(int(dataElement.@x) / 32, int(dataElement.@y) / 32, int(dataElement.@tx) / 32);
				_grid.setTile(int(dataElement.@x) / 32, int(dataElement.@y) / 32,  !((int(dataElement.@tx) / 32) == 0||(int(dataElement.@tx) / 32) == 3));
			}
		}
		
		override public function update():void 
		{
		/*	if (collide("player", x, y))
			{
				trace(x, y);
				FP.world.getType("player")
			}
			*/
			super.update();
		}
	}

}