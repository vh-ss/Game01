package  
{

	import flash.display.BitmapData;
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.World;
	import net.flashpunk.utils.Input;
	import net.flashpunk.FP;
	
	/**
	 * ...
	 * @author vadim
	 */
	public class GameWorld extends World 
	{
		
		[Embed(source = "Level1.oel", mimeType = "application/octet-stream")] private static const DEFAULT_MAP:Class;
		[Embed(source = "testLevel.oel", mimeType = "application/octet-stream")] private static const DEFAULT_MAP1:Class;
		public function GameWorld() 
		{
			
		}
		public var kenny:Player;
		
		override public function begin():void 
		{
			
			
			
			//add(new House());
			//add(new House());
			//add(new House());
			//add(new Home());
			//add(new Enemy());
			//add(new Enemy());
			//add(new Enemy());
			var level1:Level = Level(add(new Level(DEFAULT_MAP1)));
			var dataList:XMLList;
			var dataElement:XML;
			
			
			
			
			dataList = level1.levelData.Objects.house;
			for each (dataElement in dataList)
			{
				add(new House(new Point(dataElement.@x,dataElement.@y)));
			}
			
			
			
			dataList = level1.levelData.Objects.home;
			for each (dataElement in dataList)
			{
				add(new Home(new Point(dataElement.@x,dataElement.@y)));
			}
			
			dataList = level1.levelData.Objects.zombieStart;
			for each (dataElement in dataList)
			{
				add(new Enemy(new Point(dataElement.@x,dataElement.@y)));
			}
			
			
			
			dataList = level1.levelData.Objects.coins;
			
			for each (dataElement in dataList)
			{
				add(new Coin(new Point(dataElement.@x,dataElement.@y)));
			}
			super.begin();
			
			dataList = level1.levelData.Objects.playerStart;
			
			for each (dataElement in dataList)
			{
				add(new Player(new Point(dataElement.@x,dataElement.@y)));
			}
			
			add(new TopPanel());
		}
		
		
		
	}

}