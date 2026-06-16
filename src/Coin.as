package  
{
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.FP;
	
	/**
	 * ...
	 * @author vadim
	 */
	public class Coin extends Entity 
	{
		[Embed(source = '../assets/graphics/coins.png')] public const COIN_GRAPHIC:Class;
		public function Coin(position:Point) 
		{
			x = position.x;
			y = position.y;
			graphic = new Image(COIN_GRAPHIC);
			setHitbox(8, 8, 0 - FP.screen.x-10, 0 - FP.screen.y-10 );
			type = "coin";
		}
		
		override public function update():void 
		{
			collisions();
			super.update();
		}
		
		private function collisions():void 
		{
			if (collide("player", x, y))
			{
				Assets.UpdateCoins();
				//Assets.TOTALCOINS.Update();
				FP.world.remove(this);
			}
		}
		
	}

}